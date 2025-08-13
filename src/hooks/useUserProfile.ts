import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type UserProfile = {
  id: string;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  country: 'US' | 'CA';
  approved: boolean;
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
      .select("id, username, first_name, last_name, country, approved")
      .eq("id", uid)
      .maybeSingle();
    if (!error && data) {
      setProfile({
        id: data.id,
        username: data.username ?? null,
        first_name: data.first_name ?? null,
        last_name: data.last_name ?? null,
        country: (data.country as any) ?? 'CA',
        approved: Boolean(data.approved)
      });
    } else {
      // No row yet: use defaults for display
      setProfile({ id: uid, username: null, first_name: null, last_name: null, country: 'CA', approved: false });
    }
    setLoading(false);
  }

  return { userId, profile, loading, refresh: () => userId && fetchProfile(userId) } as const;
}
