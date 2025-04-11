import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Only allow browser requests
  const userAgent = request.headers.get('user-agent') || '';
  const isCurl = userAgent.toLowerCase().includes('curl');
  const isPostman = userAgent.toLowerCase().includes('postman');
  const isAxios = userAgent.toLowerCase().includes('axios');

  if (isCurl || isPostman || isAxios) {
    return NextResponse.json(
      { success: false, message: 'Access denied' },
      { status: 403 }
    );
  }

  // Add security headers
  const response = NextResponse.next();
  
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Content-Security-Policy', 
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';");

  return response;
}

export const config = {
  matcher: '/api/:path*'
}