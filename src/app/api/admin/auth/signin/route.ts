import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase URL or Anon Key is missing for /api/admin/auth/signin. Check environment variables.');
}
const supabase: SupabaseClient = createClient(supabaseUrl || '', supabaseAnonKey || '');

// Generate a unique session ID (same as client-side)
const generateSessionId = (): string => {
  return crypto.randomUUID();
};

export async function POST(request: NextRequest) {
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ message: 'Server configuration error: Supabase not configured.' }, { status: 500 });
  }

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

    // IMPORTANT: Plain text password comparison, as in the original client-side code.
    // In a production application, passwords should be hashed.
    if (adminUser.password !== password) {
      return NextResponse.json({ message: "Invalid username or password." }, { status: 401 });
    }

    // Authentication successful, generate admin session ID
    const adminSessionId = generateSessionId();

    // Here, you might want to store this adminSessionId in your database associated with the adminUser.id
    // if you need to validate it server-side for other admin-protected API routes.
    // The current client-side code only stores it in localStorage.
    // For now, just returning it as the client expects.

    return NextResponse.json({
      message: 'Admin login successful.',
      adminId: adminUser.id.toString(),
      adminUsername: adminUser.username,
      adminSessionId: adminSessionId
    });

  } catch (error: any) {
    console.error('Error in admin sign-in API route:', error.message);
    return NextResponse.json({ message: 'An unexpected error occurred during admin login.' }, { status: 500 });
  }
}
