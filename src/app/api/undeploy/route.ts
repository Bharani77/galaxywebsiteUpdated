import { NextResponse } from 'next/server';
import { isBrowserRequest, validateSession } from '@/utils/securityChecks';
import { validateContentLength, sanitizeInput } from '@/utils/apiValidation';
import { rateLimit } from '@/utils/rateLimit';

const API_URL = process.env.UNDEPLOY_API_URL || 'https://buddymaster77hugs-gradio.hf.space/api/undeploy';
const MAX_REQUEST_SIZE = 1024; // 1KB
const FETCH_TIMEOUT = 10000; // 10 seconds

export async function POST(request: Request) {
  try {
    // Validate request size
    const contentLength = parseInt(request.headers.get('content-length') || '0');
    if (!validateContentLength(contentLength, MAX_REQUEST_SIZE)) {
      return NextResponse.json(
        { error: 'Request too large' },
        { status: 413 }
      );
    }

    // Check browser request and rate limiting
    if (!isBrowserRequest(request as any)) {
      return NextResponse.json(
        { error: 'Invalid request source' },
        { status: 403 }
      );
    }

    // Rate limiting
    const rateLimitResult = await rateLimit(request) as { success: boolean };
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429 }
      );
    }

    // Validate auth header
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Invalid authorization header' },
        { status: 401 }
      );
    }

    const sessionToken = authHeader.split(' ')[1];
    const body = await request.json();
    
    // Validate and sanitize input
    const modalName = sanitizeInput(body.modal_name || '');
    if (!modalName) {
      return NextResponse.json(
        { error: 'Invalid modal name' },
        { status: 400 }
      );
    }

    // Validate session
    if (!await validateSession(sessionToken, modalName)) {
      return NextResponse.json(
        { error: 'Invalid session' },
        { status: 401 }
      );
    }

    // Make API request with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modal_name: modalName }),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`API responded with status: ${response.status}`);
      }

      const data = await response.json();
      return NextResponse.json({ success: true, data }, { status: 200 });

    } finally {
      clearTimeout(timeoutId);
    }

  } catch (error) {
    console.error('Undeploy API error:', error);
    
    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json(
        { error: 'Request timeout' },
        { status: 504 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}