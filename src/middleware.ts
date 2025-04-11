import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { rateLimit } from './utils/rateLimit';

export async function middleware(request: NextRequest) {
  // Validate request size
  const contentLength = parseInt(request.headers.get('content-length') || '0');
  if (contentLength > parseInt(SECURITY_CONFIG.maxRequestSize)) {
    return new NextResponse(JSON.stringify({
      error: 'Request too large',
    }), { status: 413 });
  }

  // Rate limiting
  if (request.nextUrl.pathname.startsWith('/api')) {
    const limiter = await rateLimit(request);
    if (!limiter.success) {
      return new NextResponse(JSON.stringify({ 
        error: 'Too many requests', 
        message: 'Please try again later'
      }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': '60'
        }
      });
    }
  }

  const response = NextResponse.next();
  
  // Enhanced security headers
  const securityHeaders = {
    'X-DNS-Prefetch-Control': 'off',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';",
    'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGINS || '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Max-Age': '7200',
  };

  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
}

export const config = {
  matcher: '/api/:path*'
}