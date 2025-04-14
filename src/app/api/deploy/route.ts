import { NextResponse } from 'next/server';
import { isBrowserRequest, validateSession } from '@/utils/securityChecks';

const API_URL = process.env.DEPLOY_API_URL || 'https://buddymaster77hugs-gradio.hf.space/api/deploy';

export async function POST(request: Request) {
  try {
    if (!isBrowserRequest(request as any)) {
      return NextResponse.json({ error: 'Access denied: Browser requests only' }, { status: 403 });
    }

    const sessionToken = request.headers.get('authorization')?.split(' ')[1] ?? null;
    const body = await request.json();
    const { modal_name } = body;

    if (!await validateSession(sessionToken, modal_name)) {
      return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 });
    }

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': crypto.randomUUID(),
        'User-Agent': 'Galaxy-Deploy-Service'
      },
      body: JSON.stringify({
        repo_url: 'https://github.com/Bharani77/Modal.git',
        modal_name
      }),
      signal: AbortSignal.timeout(30000) // 30 second timeout
    });

    if (!response.ok) {
      console.error(`Deploy API error: ${response.status}`);
      return NextResponse.json(
        { error: 'Deployment failed' },
        { 
          status: response.status,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff'
          }
        }
      );
    }

    const data = await response.json();
    return NextResponse.json(
      { success: true, data },
      { 
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff'
        }
      }
    );

  } catch (error) {
    console.error('Deploy error:', error);
    
    if (error instanceof Error && error.name === 'TimeoutError') {
      return NextResponse.json(
        { error: 'Request timeout' },
        { status: 504 }
      );
    }

    return NextResponse.json(
      { error: 'Internal Server Error' },
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store'
        }
      }
    );
  }
}