// Password strength analyzer
export type PasswordStrength = 'weak' | 'fair' | 'good' | 'strong';

export interface PasswordAnalysis {
  strength: PasswordStrength;
  score: number;
  feedback: string[];
  isValid: boolean;
}

export const analyzePassword = (password: string): PasswordAnalysis => {
  const feedback: string[] = [];
  let score = 0;

  // Length check
  if (password.length >= 8) score += 2;
  else feedback.push('Use at least 8 characters');

  if (password.length >= 12) score += 1;

  // Character variety
  if (/[a-z]/.test(password)) score += 1;
  else feedback.push('Add lowercase letters');

  if (/[A-Z]/.test(password)) score += 1;
  else feedback.push('Add uppercase letters');

  if (/[0-9]/.test(password)) score += 1;
  else feedback.push('Add numbers');

  if (/[^A-Za-z0-9]/.test(password)) score += 2;
  else feedback.push('Add special characters');

  // Common patterns (reduce score)
  if (/(.)\1{2,}/.test(password)) {
    score -= 1;
    feedback.push('Avoid repeated characters');
  }

  if (/123|abc|qwe|password|admin/i.test(password)) {
    score -= 2;
    feedback.push('Avoid common patterns');
  }

  // Determine strength
  let strength: PasswordStrength = 'weak';
  if (score >= 7) strength = 'strong';
  else if (score >= 5) strength = 'good';
  else if (score >= 3) strength = 'fair';

  const isValid = score >= 4 && password.length >= 8;

  return { strength, score, feedback, isValid };
};

export const usePasswordStrength = () => {
  return { analyzePassword };
};