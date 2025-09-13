// Enhanced input validation with security controls
import { z } from 'zod';
import { useState } from 'react';

export const emailSchema = z.string()
  .email("Invalid email format")
  .max(254, "Email too long")
  .refine(email => !email.includes('..'), "Invalid email format");

export const passwordSchema = z.string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password too long")
  .regex(/[A-Z]/, "Password must contain uppercase letter")
  .regex(/[a-z]/, "Password must contain lowercase letter")
  .regex(/[0-9]/, "Password must contain number")
  .regex(/[^A-Za-z0-9]/, "Password must contain special character");

export const useInputValidation = () => {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateField = (field: string, value: any, schema: z.ZodSchema): boolean => {
    try {
      schema.parse(value);
      setErrors(prev => ({ ...prev, [field]: '' }));
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        setErrors(prev => ({ ...prev, [field]: error.errors[0]?.message || 'Invalid input' }));
      }
      return false;
    }
  };

  const getFieldError = (field: string): string | null => {
    return errors[field] || null;
  };

  const clearErrors = () => setErrors({});

  return {
    validateField,
    getFieldError,
    clearErrors,
    hasErrors: Object.values(errors).some(error => error !== '')
  };
};