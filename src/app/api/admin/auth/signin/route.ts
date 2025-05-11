import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto'; // Import crypto module
import bcrypt from 'bcrypt'; // Import bcrypt
// No need to import cookies from next/headers for setting, use NextResponse.cookies

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Use service role key

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Supabase URL or Service Role Key is missing for /api/admin/auth/signin. Check environment variables.');
}
// Supabase client will be initialized within the handler.

// Generate a unique session ID
const generateSessionId = (): string => {
  return crypto.randomUUID();
};

export async function POST(request: NextRequest) {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return NextResponse.json({ message: 'Server configuration error: Supabase (service role) not configured.' }, { status: 500 });
  }
  const supabase: SupabaseClient = createClient(supabaseUrl, supabaseServiceRoleKey);

  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ message: 'Username and password are required.' }, { status: 400 });
    }

    const { data: adminUser, error: dbError } = await supabase
      .from("admin") // Assuming your admin table is named "admin"
      .select("id, username, password") // Select only necessary fields
      .eq("username", username)
      .single();

    if (dbError) {
      console.error("Error querying admin database:", dbError.message);
      // Don't reveal if username exists or not for security, generic message.
      return NextResponse.json({ message: "Invalid username or password." }, { status: 401 });
    }

    if (!adminUser) {
      return NextResponse.json({ message: "Invalid username or password." }, { status: 401 });
    }

    // Compare hashed password (assuming admin passwords in DB are hashed)
    // If admin passwords are not yet hashed, this will fail.
    // This change assumes you will update admin passwords in the DB to be hashed.
    const passwordIsValid = await bcrypt.compare(password, adminUser.password);
    if (!passwordIsValid) {
      console.log(`Admin password validation failed for admin: ${username}.`);
      return NextResponse.json({ message: "Invalid username or password." }, { status: 401 });
    }

    // Authentication successful, generate admin session ID
    const adminSessionId = generateSessionId(); // This is a new session ID for this login

    // TODO: Consider storing this adminSessionId in an admin_sessions table in your DB,
    // associated with adminUser.id, for more robust server-side session validation.
    // For now, we'll set it in a cookie.

    const response = NextResponse.json({
      message: 'Admin login successful.',
      adminUsername: adminUser.username, // Return username for potential client-side display
    });

    const oneDayInSeconds = 24 * 60 * 60;
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/', // Or restrict to /admin paths: path: '/admin',
      maxAge: oneDayInSeconds,
    };

    response.cookies.set('adminSessionId', adminSessionId, cookieOptions);
    response.cookies.set('adminId', adminUser.id.toString(), cookieOptions);
    response.cookies.set('adminUsername', adminUser.username, cookieOptions);
    
    return response;

  } catch (error: any) {
    console.error('Error in admin sign-in API route:', error.message);
    return NextResponse.json({ message: 'An unexpected error occurred during admin login.' }, { status: 500 });
  }
}
