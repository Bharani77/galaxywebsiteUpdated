import { NextResponse } from 'next/server';
import { isBrowserRequest, validateSession } from '@/utils/securityChecks';
import { createClient } from '@supabase/supabase-js';

const API_URL = process.env.DEPLOY_API_URL || 'https://buddymaster77hugs-gradio.hf.space/api/deploy';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function POST(request: Request) {
  try {
    if (!isBrowserRequest(request as any)) {
      return NextResponse.json({ success: false }, { status: 403 });
    }

    const sessionToken = request.headers.get('authorization')?.split(' ')[1];
    const body = await request.json();
    const { modal_name } = body;

    if (!await validateSession(sessionToken, modal_name)) {
      return NextResponse.json({ success: false }, { status: 401 });
    }

    // Verify user token status
    const { data: user } = await supabase
      .from("users")
      .select("token")
      .eq("username", modal_name)
      .single();

    if (!user?.token) {
      return NextResponse.json({ success: false }, { status: 401 });
    }

    const { data: tokenData } = await supabase
      .from('tokengenerate')
      .select('status, expiresat')
      .eq('token', user.token)
      .single();

    if (!tokenData || ['Invalid', 'N/A'].includes(tokenData.status)) {
      return NextResponse.json({ success: false }, { status: 401 });
    }

    if (tokenData.expiresat && new Date(tokenData.expiresat) < new Date()) {
      return NextResponse.json({ success: false, expired: true }, { status: 401 });
    }

    // Internal API call - hide from network tab
    const response = await fetch(process.env.DEPLOY_API_URL!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        repo_url: process.env.REPO_URL,
        modal_name
      })
    });

    // Only return success status, hide implementation details
    return NextResponse.json({ success: true }, { status: 200 });

  } catch (error) {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}