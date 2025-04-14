import { z } from 'zod';

export function validateContentLength(length: number, maxSize: number): boolean {
  return length > 0 && length <= maxSize;
}

export function sanitizeInput(input: string): string {
  return input.trim().replace(/[^a-zA-Z0-9_-]/g, '');
}

export const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};
