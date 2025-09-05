import { useState, useCallback } from 'react';
import { z } from 'zod';

// Validation schemas
export const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be less than 128 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

export const emailSchema = z.string()
  .email('Please enter a valid email address')
  .max(254, 'Email must be less than 254 characters');

export const usernameSchema = z.string()
  .min(3, 'Username must be at least 3 characters')
  .max(30, 'Username must be less than 30 characters')
  .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores');

export const nameSchema = z.string()
  .min(1, 'Name is required')
  .max(50, 'Name must be less than 50 characters')
  .regex(/^[a-zA-Z\s'-]+$/, 'Name can only contain letters, spaces, hyphens, and apostrophes');

export const tickerSchema = z.string()
  .min(1, 'Ticker is required')
  .max(10, 'Ticker must be less than 10 characters')
  .regex(/^[A-Z0-9.-]+$/, 'Ticker can only contain uppercase letters, numbers, periods, and hyphens');

export const numericSchema = z.number()
  .min(0.01, 'Value must be greater than 0')
  .max(1000000, 'Value must be less than 1,000,000');

export interface ValidationError {
  field: string;
  message: string;
}

export function useInputValidation() {
  const [errors, setErrors] = useState<ValidationError[]>([]);

  const validateField = useCallback((field: string, value: any, schema: z.ZodSchema) => {
    try {
      schema.parse(value);
      setErrors(prev => prev.filter(error => error.field !== field));
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newError = { field, message: error.errors[0].message };
        setErrors(prev => {
          const filtered = prev.filter(e => e.field !== field);
          return [...filtered, newError];
        });
      }
      return false;
    }
  }, []);

  const validateMultiple = useCallback((validations: Array<{ field: string; value: any; schema: z.ZodSchema }>) => {
    let isValid = true;
    const newErrors: ValidationError[] = [];

    validations.forEach(({ field, value, schema }) => {
      try {
        schema.parse(value);
      } catch (error) {
        if (error instanceof z.ZodError) {
          newErrors.push({ field, message: error.errors[0].message });
          isValid = false;
        }
      }
    });

    setErrors(newErrors);
    return isValid;
  }, []);

  const clearErrors = useCallback(() => {
    setErrors([]);
  }, []);

  const getFieldError = useCallback((field: string) => {
    return errors.find(error => error.field === field)?.message;
  }, [errors]);

  return {
    errors,
    validateField,
    validateMultiple,
    clearErrors,
    getFieldError,
  };
}