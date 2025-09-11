// Basic sanitization utilities
export const sanitizeEmail = (email: string): string => {
  return email.trim().toLowerCase();
};

export const checkRateLimit = (key: string, maxAttempts: number, windowMs: number): boolean => {
  // Simple stub - always allow for now
  return true;
};