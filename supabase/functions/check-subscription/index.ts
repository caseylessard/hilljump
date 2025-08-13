import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, details?: unknown) => {
  console.log(`[check-subscription] ${step}`, details ?? "");
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseService = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("Missing STRIPE_SECRET_KEY");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No Authorization header");
    const token = authHeader.replace("Bearer ", "");

    const { data: userData, error: userError } = await supabaseService.auth.getUser(token);
    if (userError) throw new Error(userError.message);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email missing");

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    // Find customer by email
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    if (customers.data.length === 0) {
      log("No Stripe customer found; marking unsubscribed");
      await supabaseService.from("subscribers").upsert({
        email: user.email,
        user_id: user.id,
        stripe_customer_id: null,
        subscribed: false,
        subscription_tier: null,
        subscription_end: null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "email" });
      // Clean up roles: remove premium/subscriber
      await supabaseService.from("user_roles").delete().eq("user_id", user.id).in("role", ["premium", "subscriber"]);

      return new Response(JSON.stringify({ subscribed: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
      expand: ["data.items.data.price"],
    });

    const hasActive = subscriptions.data.length > 0;

    let tier: string | null = null;
    let periodEnd: string | null = null;

    if (hasActive) {
      const sub = subscriptions.data[0];
      periodEnd = new Date(sub.current_period_end * 1000).toISOString();
      const price = sub.items.data[0].price;
      const amount = price.unit_amount || 0;
      tier = amount >= 2900 ? "premium" : "subscriber";
      log("Active subscription", { amount, tier });

      // ensure only one of premium/subscriber roles
      await supabaseService.from("user_roles").delete().eq("user_id", user.id).in("role", ["premium", "subscriber"]);
      await supabaseService.from("user_roles").insert({ user_id: user.id, role: tier });
    } else {
      // remove premium/subscriber roles if no active sub
      await supabaseService.from("user_roles").delete().eq("user_id", user.id).in("role", ["premium", "subscriber"]);
    }

    await supabaseService.from("subscribers").upsert({
      email: user.email,
      user_id: user.id,
      stripe_customer_id: customerId,
      subscribed: hasActive,
      subscription_tier: tier,
      subscription_end: periodEnd,
      updated_at: new Date().toISOString(),
    }, { onConflict: "email" });

    return new Response(JSON.stringify({ subscribed: hasActive, subscription_tier: tier, subscription_end: periodEnd }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    console.error("[check-subscription] error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
