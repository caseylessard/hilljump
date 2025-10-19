// Real security monitoring with database persistence via edge function
import { supabase } from "@/integrations/supabase/client";

const getUserInfo = () => {
  if (typeof window !== 'undefined') {
    return {
      ip_address: 'unknown', // Client-side can't get real IP
      user_agent: navigator.userAgent
    };
  }
  return { ip_address: 'unknown', user_agent: 'unknown' };
};

export const useSecurityMonitoring = () => {
  const logSecurityEvent = async (
    event_type: string, 
    metadata: any = {}, 
    user_id?: string
  ) => {
    try {
      const userInfo = getUserInfo();
      
      // Call edge function instead of direct insert (prevents log poisoning)
      await supabase.functions.invoke('log-security-event', {
        body: {
          event_type,
          user_id: user_id || null,
          metadata,
          ip_address: userInfo.ip_address,
          user_agent: userInfo.user_agent
        }
      });
    } catch (error) {
      // Silently fail to prevent blocking user actions
      console.error('Failed to log security event:', error);
    }
  };

  return {
    logFailedLogin: async (email: string, error: string, user_id?: string) => {
      await logSecurityEvent('failed_login', { email, error }, user_id);
    },
    logSuccessfulLogin: async (user_id?: string) => {
      await logSecurityEvent('successful_login', {}, user_id);
    },
    logSuspiciousActivity: async (type: string, data: any, user_id?: string) => {
      await logSecurityEvent('suspicious_activity', { type, ...data }, user_id);
    },
    logPasswordReset: async (email: string) => {
      await logSecurityEvent('password_reset_request', { email });
    },
    logRoleChange: async (target_user_id: string, new_role: string, user_id?: string) => {
      await logSecurityEvent('role_change', { target_user_id, new_role }, user_id);
    }
  };
};