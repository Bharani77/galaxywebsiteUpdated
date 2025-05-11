import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import bcrypt from 'bcrypt';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
// const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; // No longer using module-level anon client
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Added for service client

if (!supabaseUrl) {
  console.error('Supabase URL is missing for /api/auth/signup. Check environment variables.');
}
// Module-level Supabase client removed, will be created with service role key in handler.
const SALT_ROUNDS = 10; // Standard salt rounds for bcrypt

export async function POST(request: NextRequest) {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return NextResponse.json({ message: 'Server configuration error: Supabase (service role) not configured.' }, { status: 500 });
  }

  // Create a Supabase client with the service role key for this handler
  const supabaseService: SupabaseClient = createClient(supabaseUrl, supabaseServiceRoleKey);

  try {
    const { username, password, token: signupToken } = await request.json();

    if (!username || !password || !signupToken) {
      return NextResponse.json({ message: 'Username, password, and token are required.' }, { status: 400 });
    }
    if (password.length < 8) {
        return NextResponse.json({ message: 'Password must be at least 8 characters long.' }, { status: 400 });
    }

    // 1. Verify Token (from client-side verifyToken)
    const { data: tokenDataArray, error: tokenVerifyError } = await supabaseService // Use service client
      .from('tokengenerate')
      .select('*')
      .eq('token', signupToken);

    if (tokenVerifyError) {
      console.error('Error verifying token in DB:', tokenVerifyError.message);
      return NextResponse.json({ message: 'Token verification failed. Please try again.' }, { status: 500 });
    }
    if (!tokenDataArray || tokenDataArray.length === 0) {
      return NextResponse.json({ message: 'Invalid token provided.' }, { status: 400 });
    }
    const tokenEntry = tokenDataArray[0];
    if (tokenEntry.status === 'InUse') {
      return NextResponse.json({ message: 'Token has already been used.' }, { status: 400 });
    }

    // 2. Hash password and Insert User
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const { data: newUser, error: userInsertError } = await supabaseService // Use service client
      .from("users")
      .insert([{ username, password: hashedPassword, token: signupToken }]) // Store hashed password
      .select()
      .single();

    if (userInsertError) {
      if (userInsertError.code === '23505') { // Unique constraint violation (e.g., username taken)
        return NextResponse.json({ message: 'Username already taken. Please try a different one.' }, { status: 409 }); // 409 Conflict
      }
      console.error('Error inserting user:', userInsertError.message);
      return NextResponse.json({ message: 'Failed to create user.' }, { status: 500 });
    }

    if (!newUser || !newUser.id) {
        console.error('User insertion did not return expected data.');
        return NextResponse.json({ message: 'Failed to create user (unexpected data).' }, { status: 500 });
    }
    const userId = newUser.id;

    // 3. Associate Token with User & Update Token Status (from client-side)
    const { error: tokenUpdateError } = await supabaseService // Use service client
      .from('tokengenerate')
      .update({ userid: userId, status: 'InUse' }) // Combine association and status update
      .eq('token', signupToken);

    if (tokenUpdateError) {
      console.error('Error updating token status/association:', tokenUpdateError.message);
      // At this point, user is created but token update failed. This is a partial success/failure state.
      // Depending on policy, might need to roll back user creation or flag for admin.
      // For now, return an error indicating this specific step failed.
      return NextResponse.json({ message: 'User created, but failed to update token status.' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Signup successful!' }, { status: 201 }); // 201 Created

  } catch (error: any) {
    console.error('Error in sign-up API route:', error.message);
    return NextResponse.json({ message: 'An unexpected error occurred during sign up.' }, { status: 500 });
  }
}
