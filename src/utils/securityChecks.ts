import { NextRequest } from 'next/server';
import { validateSecureSession } from './sessionManager';

export const isBrowserRequest = (request: NextRequest) => {
  const userAgent = request.headers.get('user-agent');
  return userAgent && !userAgent.toLowerCase().includes('curl') && !userAgent.toLowerCase().includes('postman');
};

export async function validateRequestSession(): Promise<boolean> {
  return validateSecureSession();
}
