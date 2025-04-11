import { z } from 'zod';

export const validateContentLength = (length: number, maxSize: number) => {
  return length > 0 && length <= maxSize;
};

export const sanitizeInput = (input: string): string => {
  return input.replace(/[^a-zA-Z0-9-_]/g, '');
};

export const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};
