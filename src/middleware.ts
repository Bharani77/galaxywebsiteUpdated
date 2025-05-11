import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { validateSession as validateUserSession } from '@/lib/auth'; 
import { validateAdminSession } from '@/lib/adminAuth';

// Define paths that are public (don't require authentication)
const PUBLIC_PATHS = [
  '/signin',          // Regular user sign-in page
  '/signup',          // Regular user sign-up page
  '/admin',           // Admin sign-in page (src/app/admin/page.tsx)
  // API routes for authentication are handled by the startsWith('/api/auth/') check below
];

// This function can be marked `async` if using `await` inside
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow requests to Next.js internals, static files, and public auth API routes
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/api/auth/') || // Covers /api/auth/signin, /api/auth/signup, /api/auth/signout, /api/auth/validate-client-session etc.
    pathname.startsWith('/api/admin/auth/signin') || // Public admin sign-in API
    pathname.includes('.') // Simple check for files like favicon.ico, images, etc.
  ) {
    return NextResponse.next();
  }
  
  // Check if the path is explicitly public (e.g., /signin, /signup, /admin/signin pages)
  if (PUBLIC_PATHS.some(path => pathname === path)) { // Use strict equality for specific pages
    return NextResponse.next();
  }

  // Handle Admin routes
  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
    const adminSession = await validateAdminSession(request); // Reads from admin cookies
    if (!adminSession) {
      if (pathname.startsWith('/api/admin')) {
        return NextResponse.json({ message: 'Admin authentication required.' }, { status: 401 });
      }
      // Redirect to admin sign-in page (which is /admin)
      const adminSignInUrl = new URL('/admin', request.url); 
      adminSignInUrl.searchParams.set('redirectedFrom', pathname);
      return NextResponse.redirect(adminSignInUrl);
    }
    // Admin session is valid. 
    // If the admin is trying to access the login page (/admin) itself while already logged in,
    // we should redirect them to the dashboard.
    if (pathname === '/admin') {
      return NextResponse.redirect(new URL('/admin/dashboard', request.url));
    }
    // Otherwise, proceed
    // Optionally add admin data to headers if needed by admin API routes
    // const requestHeaders = new Headers(request.headers);
    // requestHeaders.set('X-Admin-Session', JSON.stringify(adminSession));
    // return NextResponse.next({ request: { headers: requestHeaders } });
    return NextResponse.next();
  }

  // For all other non-admin protected paths, validate the regular user session
  const userSession = await validateUserSession(request); // Reads from user cookies
  if (!userSession) {
    if (pathname.startsWith('/api/')) { // For other API routes (e.g., /api/git)
      return NextResponse.json({ message: 'User authentication required.' }, { status: 401 });
    }
    // Redirect to regular user sign-in page
    const signInUrl = new URL('/signin', request.url);
    signInUrl.searchParams.set('redirectedFrom', pathname);
    return NextResponse.redirect(signInUrl);
  }

  // User session is valid, proceed
  // Optionally add user data to headers
  // const requestHeaders = new Headers(request.headers);
  // requestHeaders.set('X-User-Session', JSON.stringify(userSession));
  // return NextResponse.next({ request: { headers: requestHeaders } });
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - api/auth/ (public authentication API routes for users)
     * - api/admin/auth/signin (public admin sign-in API route)
     *
     * This negative lookahead ensures these paths are NOT processed by the middleware,
     * allowing them to be handled by their respective route handlers or be served directly.
     * All other paths will be processed by the middleware.
     */
    '/((?!_next/static|_next/image|favicon.ico|api/auth/|api/admin/auth/signin).*)',
  ],
};
