import { useCallback } from 'react';
import { supabase } from "@/integrations/supabase/client";

export interface SecurityEvent {
  eventType: string;
  metadata?: Record<string, any>;
}

export function useSecurityMonitoring() {
  const logSecurityEvent = useCallback(async (event: SecurityEvent) => {
    try {
      // Get client info for security logging
      const userAgent = navigator.userAgent;
      const timestamp = new Date().toISOString();
      
      await supabase
        .from('security_events')
        .insert({
          event_type: event.eventType,
          user_agent: userAgent,
          metadata: {
            ...event.metadata,
            timestamp,
            url: window.location.href,
          },
        });
    } catch (error) {
      console.error('Failed to log security event:', error);
    }
  }, []);

  const logFailedLogin = useCallback(async (email: string, reason: string) => {
    await logSecurityEvent({
      eventType: 'failed_login_attempt',
      metadata: {
        email,
        reason,
        timestamp: new Date().toISOString(),
      },
    });
  }, [logSecurityEvent]);

  const logSuccessfulLogin = useCallback(async () => {
    await logSecurityEvent({
      eventType: 'successful_login',
      metadata: {
        timestamp: new Date().toISOString(),
      },
    });
  }, [logSecurityEvent]);

  const logPasswordReset = useCallback(async (email: string) => {
    await logSecurityEvent({
      eventType: 'password_reset_request',
      metadata: {
        email,
        timestamp: new Date().toISOString(),
      },
    });
  }, [logSecurityEvent]);

  const logSuspiciousActivity = useCallback(async (activityType: string, details: Record<string, any>) => {
    await logSecurityEvent({
      eventType: 'suspicious_activity',
      metadata: {
        activityType,
        ...details,
        timestamp: new Date().toISOString(),
      },
    });
  }, [logSecurityEvent]);

  return {
    logSecurityEvent,
    logFailedLogin,
    logSuccessfulLogin,
    logPasswordReset,
    logSuspiciousActivity,
  };
}