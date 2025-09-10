import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Bulk hook to fetch all user-related data in a single optimized call
export const useBulkUserData = () => {
  return useQuery({
    queryKey: ["bulk-user-data"],
    queryFn: async () => {
      // Get current session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        return {
          user: null,
          profile: null,
          isAdmin: false,
          isSubscribed: false,
          portfolioPositions: []
        };
      }

      const userId = session.user.id;

      try {
        // Fetch all user-related data in parallel for maximum efficiency
        const [
          { data: profile, error: profileError },
          { data: roles, error: rolesError },
          { data: subscription, error: subError },
          { data: positions, error: positionsError }
        ] = await Promise.all([
          supabase
            .from('profiles')
            .select('id, username, first_name, last_name, country, approved')
            .eq('id', userId)
            .maybeSingle(),
          supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', userId),
          supabase
            .from('subscribers')
            .select('subscribed')
            .eq('user_id', userId)
            .maybeSingle(),
          supabase
            .from('portfolio_positions')
            .select('*')
            .eq('user_id', userId)
            .order('created_at')
        ]);

        // Handle errors gracefully
        if (profileError) console.warn('Profile fetch error:', profileError);
        if (rolesError) console.warn('Roles fetch error:', rolesError);
        if (subError) console.warn('Subscription fetch error:', subError);
        if (positionsError) console.warn('Positions fetch error:', positionsError);

        const isAdmin = Array.isArray(roles) && roles.some((r: any) => 
          String(r.role).toLowerCase() === 'admin'
        );
        
        const isSubscribed = Boolean(subscription?.subscribed);

        console.log('✅ Loaded bulk user data');

        return {
          user: session.user,
          profile: profile || null,
          isAdmin,
          isSubscribed,
          portfolioPositions: positions || []
        };

      } catch (error) {
        console.error('❌ Bulk user data fetch failed:', error);
        return {
          user: session.user,
          profile: null,
          isAdmin: false,
          isSubscribed: false,
          portfolioPositions: []
        };
      }
    },
    staleTime: 2 * 60 * 1000, // 2 minutes cache
    refetchOnMount: false,
    refetchOnWindowFocus: true,
  });
};

// Optimized admin check hook that uses the bulk data
export const useOptimizedAdmin = () => {
  const { data: bulkUserData } = useBulkUserData();
  
  return {
    isAdmin: bulkUserData?.isAdmin || false,
    isLoading: !bulkUserData,
    profile: bulkUserData?.profile
  };
};