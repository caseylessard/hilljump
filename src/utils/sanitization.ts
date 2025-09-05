/**
 * Sanitization utilities for preventing XSS and other security issues
 */

/**
 * Sanitize HTML input to prevent XSS attacks
 */
export function sanitizeHtml(input: string): string {
  if (!input) return '';
  
  // Remove script tags and their contents
  let sanitized = input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  
  // Remove javascript: protocol links
  sanitized = sanitized.replace(/javascript:/gi, '');
  
  // Remove on* event handlers
  sanitized = sanitized.replace(/\son\w+\s*=\s*["'][^"']*["']/gi, '');
  sanitized = sanitized.replace(/\son\w+\s*=\s*[^"'>\s]+/gi, '');
  
  return sanitized;
}

/**
 * Sanitize text input for safe display
 */
export function sanitizeText(input: string): string {
  if (!input) return '';
  
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Validate and sanitize stock ticker symbols
 */
export function sanitizeTicker(ticker: string): string {
  if (!ticker) return '';
  
  return ticker
    .toUpperCase()
    .replace(/[^A-Z0-9.-]/g, '')
    .substring(0, 10);
}

/**
 * Validate and sanitize numeric input
 */
export function sanitizeNumeric(value: string | number): number | null {
  if (typeof value === 'number') {
    return isFinite(value) && value >= 0 ? value : null;
  }
  
  const numericValue = parseFloat(value.replace(/[^0-9.-]/g, ''));
  return isFinite(numericValue) && numericValue >= 0 ? numericValue : null;
}

/**
 * Sanitize username input
 */
export function sanitizeUsername(username: string): string {
  if (!username) return '';
  
  return username
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .substring(0, 30);
}

/**
 * Sanitize name input (first/last names)
 */
export function sanitizeName(name: string): string {
  if (!name) return '';
  
  return name
    .replace(/[^a-zA-Z\s'-]/g, '')
    .trim()
    .substring(0, 50);
}

/**
 * Validate email format and sanitize
 */
export function sanitizeEmail(email: string): string {
  if (!email) return '';
  
  // Basic email sanitization - remove dangerous characters
  const sanitized = email
    .toLowerCase()
    .trim()
    .replace(/[<>]/g, '')
    .substring(0, 254);
  
  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(sanitized) ? sanitized : '';
}

/**
 * Rate limiting helper - tracks attempts by IP/user
 */
const attemptTracker = new Map<string, { count: number; lastAttempt: number }>();

export function checkRateLimit(identifier: string, maxAttempts: number = 5, windowMs: number = 15 * 60 * 1000): boolean {
  const now = Date.now();
  const key = identifier;
  
  const attempts = attemptTracker.get(key);
  
  if (!attempts || now - attempts.lastAttempt > windowMs) {
    attemptTracker.set(key, { count: 1, lastAttempt: now });
    return true;
  }
  
  if (attempts.count >= maxAttempts) {
    return false;
  }
  
  attempts.count++;
  attempts.lastAttempt = now;
  attemptTracker.set(key, attempts);
  
  return true;
}