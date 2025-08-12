import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type UserProfile = {
  id: string;
  first_name: string | null;
  country: 'US' | 'CA';
};

export function useUserProfile() {
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      const uid = session?.user?.id ?? null;
      setUserId(uid);
      if (!uid) {
        setProfile(null);
      } else {
        // defer fetching to avoid deadlocks
        setTimeout(() => fetchProfile(uid), 0);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      const uid = data.session?.user?.id ?? null;
      setUserId(uid);
      if (uid) fetchProfile(uid);
      else setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(uid: string) {
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, first_name, country")
      .eq("id", uid)
      .maybeSingle();
    if (!error && data) {
      setProfile({ id: data.id, first_name: data.first_name, country: (data.country as any) ?? 'CA' });
    } else {
      // No row yet: use defaults for display
      setProfile({ id: uid, first_name: null, country: 'CA' });
    }
    setLoading(false);
  }

  return { userId, profile, loading, refresh: () => userId && fetchProfile(userId) } as const;
}
