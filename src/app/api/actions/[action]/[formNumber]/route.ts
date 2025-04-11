import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function POST(
  request: Request,
  { params }: { params: { action: string; formNumber: string } }
) {
  try {
    const sessionToken = request.headers.get('authorization')?.split(' ')[1];
    const body = await request.json();
    const { data, username } = body;

    if (!sessionToken) {
      return NextResponse.json({ success: false }, { status: 401 });
    }

    // Verify session and user status
    const { data: user } = await supabase
      .from("users")
      .select("token, session_token")
      .eq("username", username)
      .eq("session_token", sessionToken)
      .single();

    if (!user?.token || user.session_token !== sessionToken) {
      return NextResponse.json({ success: false }, { status: 401 });
    }

    // Make internal API call
    const baseUrl = process.env.MODAL_API_BASE_URL!.replace('{username}', username);
    const response = await fetch(`${baseUrl}/${params.action}/${params.formNumber}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    // Return minimal response
    return NextResponse.json({ success: true }, { status: 200 });

  } catch (error) {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}