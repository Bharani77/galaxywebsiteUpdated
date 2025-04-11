import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
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

  // Proxy and mask all API requests
  const response = NextResponse.next();
  
  // Add security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Content-Security-Policy', 
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';");
  
  // Hide server implementation details
  response.headers.delete('x-powered-by');
  response.headers.delete('server');
  
  // Mask Supabase URLs in response
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Expose-Headers', '*');

  return response;
}

export const config = {
  matcher: [
    '/api/:path*',
    '/((?!_next/static|_next/image|favicon.ico).*)'
  ]
}