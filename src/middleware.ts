import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { rateLimit } from './utils/rateLimit';
import { SECURITY_CONFIG } from '@/config/security';

export async function middleware(request: NextRequest) {
  try {
    // Validate request size
    const contentLength = parseInt(request.headers.get('content-length') || '0', 10);
    if (isNaN(contentLength) || contentLength > SECURITY_CONFIG.maxRequestSize) {
      return new NextResponse(
        JSON.stringify({ error: 'Request too large' }), 
        { 
          status: 413,
          headers: getSecurityHeaders()
        }
      );
    }

    // Rate limiting for API routes
    if (request.nextUrl.pathname.startsWith('/api')) {
      const limiter = await rateLimit(request);
      if (!limiter.success) {
        return new NextResponse(
          JSON.stringify({ 
            error: 'Too many requests', 
            message: 'Please try again later'
          }), 
          {
            status: 429,
            headers: {
              ...getSecurityHeaders(),
              'Retry-After': '60',
              'X-RateLimit-Limit': limiter.limit.toString(),
              'X-RateLimit-Remaining': limiter.remaining.toString(),
              'X-RateLimit-Reset': Math.ceil(limiter.reset / 1000).toString()
            }
          }
        );
      }
    }

    // Add session validation for protected routes
    if (request.nextUrl.pathname.startsWith('/api/protected')) {
      const isValidSession = await validateRequestSession(request);
      if (!isValidSession) {
        return new NextResponse(
          JSON.stringify({ error: 'Invalid session' }), 
          { status: 401 }
        );
      }
    }

    const response = NextResponse.next();
    Object.entries(getSecurityHeaders()).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;
  } catch (error) {
    console.error('Middleware error:', error);
    return new NextResponse(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500,
        headers: getSecurityHeaders()
      }
    );
  }
}

function getSecurityHeaders() {
  const allowedOrigins = SECURITY_CONFIG.headers.allowedOrigins.join(',') || '*';
  return {
    'X-DNS-Prefetch-Control': 'off',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';",
    'Access-Control-Allow-Origin': allowedOrigins,
    'Access-Control-Allow-Methods': SECURITY_CONFIG.headers.allowedMethods.join(', '),
    'Access-Control-Max-Age': '7200',
  };
}

async function validateRequestSession(request: NextRequest): Promise<boolean> {
  try {
    const sessionToken = request.headers.get('Authorization')?.replace('Bearer ', '');
    
    if (!sessionToken) {
      return false;
    }

    // Here you would typically:
    // 1. Verify the JWT token
    // 2. Check if the session exists in your database
    // 3. Validate the session hasn't expired
    
    // This is a placeholder implementation
    // Replace with your actual session validation logic
    const isValidToken = sessionToken.length > 0;
    return isValidToken;

  } catch (error) {
    console.error('Session validation error:', error);
    return false;
  }
}

export const config = {
  matcher: '/api/:path*'
}
