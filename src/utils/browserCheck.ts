import { NextRequest } from 'next/server';

export function isBrowserRequest(request: NextRequest): boolean {
  const userAgent = request.headers.get('user-agent');
  return Boolean(userAgent && !userAgent.includes('node-fetch') && !userAgent.includes('postman'));
}
