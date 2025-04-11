import { NextResponse } from 'next/server';
import { isBrowserRequest, validateSession } from '@/utils/securityChecks';

const API_URL = process.env.STATUS_API_URL || 'https://buddymaster77hugs-gradio.hf.space/api/status';

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

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modal_name })
    });

    const data = await response.json();
    return NextResponse.json(
      { success: true, deployed: data.status === "deployed" },
      { status: 200 }
    );

  } catch (error) {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}