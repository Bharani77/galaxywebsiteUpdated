import { NextRequest, NextResponse } from 'next/server';
import { validateSession } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const session = await validateSession(request);

  if (!session) { // UserSession itself can be null, no nested .user
    return NextResponse.json({ message: 'Authentication required.' }, { status: 401 });
  }

  // Ensure tokenExpiresAt is a string or number that can be sent in JSON
  // If it's a Date object, convert it to ISO string or timestamp
  let tokenExpiresAtToSend: string | number | null = null;
  if (session.tokenExpiresAt) { // Access directly from session object
    if (session.tokenExpiresAt instanceof Date) {
      tokenExpiresAtToSend = session.tokenExpiresAt.toISOString();
    } else {
      // Assuming it's already a string (ISO) or number (timestamp)
      tokenExpiresAtToSend = session.tokenExpiresAt;
    }
  }

  return NextResponse.json({
    username: session.username, // Access directly from session object
    tokenExpiresAt: tokenExpiresAtToSend,
    // Add any other non-sensitive session details the client might need
  });
}
