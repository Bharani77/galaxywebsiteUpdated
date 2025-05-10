import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface AdminSession {
  adminId: string;
  adminUsername: string;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase URL or Anon Key is missing for adminAuth. Check environment variables.');
}
const supabase: SupabaseClient = createClient(supabaseUrl || '', supabaseAnonKey || '');

/**
 * Validates the admin session details from request headers.
 * 
 * Expects:
 * - 'X-Admin-ID': 'ADMIN_ID_FROM_LOCALSTORAGE'
 * - 'X-Admin-Username': 'ADMIN_USERNAME_FROM_LOCALSTORAGE'
 * - 'X-Admin-Session-ID': 'ADMIN_SESSION_ID_FROM_LOCALSTORAGE' (currently not validated against DB)
 * 
 * @param request The NextRequest object.
 * @returns The admin session object if valid, otherwise null.
 */
export async function validateAdminSession(request: NextRequest): Promise<AdminSession | null> {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Supabase client not initialized in validateAdminSession.');
    return null;
  }

  const adminId = request.headers.get('X-Admin-ID');
  const adminUsername = request.headers.get('X-Admin-Username');
  const adminSessionId = request.headers.get('X-Admin-Session-ID'); // Currently for presence, not DB validation

  if (!adminId || !adminUsername || !adminSessionId) {
    console.log('Missing Admin authentication headers.');
    return null;
  }

  try {
    // Basic validation: Check if an admin with this ID and username exists.
    // A more robust solution would involve validating adminSessionId against a server-side store
    // or using signed JWTs for admin sessions.
    const { data: adminUser, error } = await supabase
      .from('admin')
      .select('id, username')
      .eq('id', adminId)
      .eq('username', adminUsername)
      .single();

    if (error || !adminUser) {
      console.error('Admin session validation failed (user not found or DB error):', error?.message);
      return null;
    }

    // If validation passes:
    console.log('Admin session validated for:', adminUser.username);
    return { adminId: adminUser.id.toString(), adminUsername: adminUser.username };

  } catch (e: any) {
    console.error('Exception during admin session validation:', e.message);
    return null;
  }
}
