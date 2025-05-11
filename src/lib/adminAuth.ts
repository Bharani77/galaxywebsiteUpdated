import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface AdminSession {
  adminId: string;
  adminUsername: string;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
// const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; // No longer used for module-level client here
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Added for service client

if (!supabaseUrl) {
  console.error('Supabase URL is missing for adminAuth. Check environment variables.');
}
// Module-level Supabase client removed as validateAdminSession will create its own service client.

/**
 * Validates the admin session details from cookies.
 * 
 * Expects cookies:
 * - 'adminId'
 * - 'adminUsername'
 * - 'adminSessionId' (currently only checks for presence, not validated against DB)
 * 
 * @param request The NextRequest object.
 * @returns The admin session object if valid, otherwise null.
 */
export async function validateAdminSession(request: NextRequest): Promise<AdminSession | null> {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.error('Supabase URL or Service Role Key is missing for admin session validation. Check environment variables.');
    return null;
  }

  const adminIdCookie = request.cookies.get('adminId');
  const adminUsernameCookie = request.cookies.get('adminUsername');
  const adminSessionIdCookie = request.cookies.get('adminSessionId');

  if (!adminIdCookie?.value || !adminUsernameCookie?.value || !adminSessionIdCookie?.value) {
    console.log('Missing one or more admin session cookies (adminId, adminUsername, adminSessionId).');
    return null;
  }

  const adminId = adminIdCookie.value;
  const adminUsername = adminUsernameCookie.value;
  // const adminSessionId = adminSessionIdCookie.value; // Available if needed for DB validation

  // Create a Supabase client with the service role key for this specific function
  const supabaseServiceAdmin: SupabaseClient = createClient(supabaseUrl, supabaseServiceRoleKey);

  try {
    // Basic validation: Check if an admin with this ID and username exists.
    // TODO: For enhanced security, validate adminSessionId against a server-side admin_sessions table.
    const { data: adminUserRecord, error } = await supabaseServiceAdmin
      .from('admin') // Assuming your admin table is named 'admin'
      .select('id, username') // Select fields to confirm existence
      .eq('id', adminId)
      .eq('username', adminUsername)
      .single();

    if (error || !adminUserRecord) {
      console.error('Admin session validation failed (admin user not found or DB error):', error?.message);
      return null;
    }

    // If validation passes (admin exists with this ID and username):
    console.log('Admin session validated via cookies for:', adminUserRecord.username);
    return { adminId: adminUserRecord.id.toString(), adminUsername: adminUserRecord.username };

  } catch (e: any) {
    console.error('Exception during admin session validation (cookies):', e.message);
    return null;
  }
}
