import { NextResponse } from 'next/server';
import { decrypt } from '@/utils/encryption';

export async function POST(request: Request, { params }: { params: { path: string[] } }) {
  try {
    const originalUrl = Buffer.from(params.path.join('/'), 'base64').toString();
    const obfuscatedBody = await request.text();
    const [_, payload] = Buffer.from(obfuscatedBody, 'base64')
      .toString()
      .split(':');
    
    const response = await fetch(originalUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: payload
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Request failed' }, { status: 500 });
  }
}
