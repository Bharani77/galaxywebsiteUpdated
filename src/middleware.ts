import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { SecurityUtils } from '@/utils/securityUtils';

export function middleware(request: NextRequest) {
  try {
    // Rate limiting check
    if (!SecurityUtils.checkRateLimit(request)) {
      return new NextResponse('Too Many Requests', { status: 429 });
    }

    // Bot and script detection
    const userAgent = request.headers.get('user-agent') || '';
    if (!SecurityUtils.validateUserAgent(userAgent)) {
      return new NextResponse('Forbidden', { status: 403 });
    }

    // Create response with security headers
    const response = NextResponse.next();
    const securityHeaders = SecurityUtils.getSecurityHeaders();
    
    // Apply all security headers
    Object.entries(securityHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;
  } catch (error) {
    console.error('Middleware error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|robots.txt).*)',
  ],
};