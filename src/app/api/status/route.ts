import { NextResponse } from 'next/server';
import { isBrowserRequest } from '@/utils/securityChecks';
import { ServerAPI } from '@/lib/server-api';
import { sanitizeResponse } from '@/utils/sanitize-response';

export async function POST(request: Request) {
  try {
    if (!isBrowserRequest(request as any)) {
      return NextResponse.json(sanitizeResponse({ success: false }), { status: 403 });
    }

    const sessionToken = request.headers.get('authorization')?.split(' ')[1];
    if (!sessionToken) {
      return NextResponse.json(sanitizeResponse({ success: false }), { status: 401 });
    }

    const body = await request.json();
    const result = await ServerAPI.checkModelStatus(body.modal_name);
    
    return NextResponse.json(
      sanitizeResponse({ success: true, deployed: result.deployed }), 
      { status: 200 }
    );

  } catch (error) {
    return NextResponse.json(sanitizeResponse({ success: false }), { status: 500 });
  }
}