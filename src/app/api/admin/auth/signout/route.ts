import { NextRequest, NextResponse } from 'next/server';
// No Supabase client needed if just clearing cookies

export async function POST(request: NextRequest) {
  try {
    const response = NextResponse.json({ message: 'Admin sign out successful.' }, { status: 200 });

    // Clear the admin cookies
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/', // Ensure path matches the one used during sign-in
      maxAge: -1, // Expire the cookie immediately
    };

    response.cookies.set('adminSessionId', '', cookieOptions);
    response.cookies.set('adminId', '', cookieOptions);
    response.cookies.set('adminUsername', '', cookieOptions);

    console.log('Admin cookies cleared.');
    return response;

  } catch (error: any) {
    console.error('Error in admin sign-out API route:', error.message);
    return NextResponse.json({ message: 'An unexpected error occurred during admin sign out.' }, { status: 500 });
  }
}
