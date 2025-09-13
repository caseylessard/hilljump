// Enhanced sanitization with database-backed rate limiting
import { supabase } from "@/integrations/supabase/client";

export const sanitizeEmail = (email: string): string => {
  return email.trim().toLowerCase().replace(/[^\w@.-]/g, '');
};

export const sanitizeInput = (input: string, maxLength: number = 100): string => {
  return input.trim().slice(0, maxLength);
};

// Database-backed rate limiting using security_events table
export const checkRateLimit = async (
  key: string, 
  maxAttempts: number, 
  windowMs: number
): Promise<boolean> => {
  try {
    const windowStart = new Date(Date.now() - windowMs);
    
    // Count recent attempts for this key
    const { data: recentAttempts, error } = await supabase
      .from('security_events')
      .select('id')
      .eq('event_type', 'rate_limit_check')
      .gte('created_at', windowStart.toISOString())
      .eq('metadata->>key', key);

    if (error) {
      console.error('Rate limit check failed:', error);
      return true; // Fail open for availability
    }

    const attemptCount = recentAttempts?.length || 0;
    
    // Log this rate limit check
    await supabase.from('security_events').insert({
      event_type: 'rate_limit_check',
      metadata: { key, attempt_count: attemptCount + 1, max_attempts: maxAttempts }
    });

    return attemptCount < maxAttempts;
  } catch (error) {
    console.error('Rate limiting error:', error);
    return true; // Fail open
  }
};

// Synchronous rate limiting fallback using localStorage
export const checkRateLimitSync = (
  key: string, 
  maxAttempts: number, 
  windowMs: number
): boolean => {
  try {
    const now = Date.now();
    const storageKey = `rate_limit_${key}`;
    const stored = localStorage.getItem(storageKey);
    
    let attempts: number[] = stored ? JSON.parse(stored) : [];
    
    // Remove expired attempts
    attempts = attempts.filter(timestamp => now - timestamp < windowMs);
    
    if (attempts.length >= maxAttempts) {
      return false;
    }
    
    // Add current attempt
    attempts.push(now);
    localStorage.setItem(storageKey, JSON.stringify(attempts));
    
    return true;
  } catch (error) {
    console.error('Rate limiting error:', error);
    return true; // Fail open
  }
};