import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const ENCRYPTION_KEY = typeof process.env.ENCRYPTION_KEY === 'string' 
  ? Buffer.from(process.env.ENCRYPTION_KEY, 'hex')
  : randomBytes(32);
const IV_LENGTH = 16;

// Add request obfuscation functions
function transformUrl(url: string): string {
  return `/api/proxy/${Buffer.from(url).toString('base64')}`;
}

function obfuscatePayload(data: any): string {
  const payload = JSON.stringify(data);
  const noise = randomBytes(32).toString('hex');
  return Buffer.from(`${noise}:${payload}`).toString('base64');
}

export async function secureRequest(url: string, options: RequestInit = {}): Promise<Response> {
  const obfuscatedUrl = transformUrl(url);
  const originalBody = options.body ? JSON.parse(options.body as string) : {};
  
  const obfuscatedOptions = {
    ...options,
    headers: {
      ...options.headers,
      'X-Request-Id': randomBytes(16).toString('hex'),
      'Content-Type': 'application/octet-stream'
    },
    body: obfuscatePayload(originalBody)
  };

  return fetch(obfuscatedUrl, obfuscatedOptions);
}

export async function encrypt(text: string): Promise<string> {
  try {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
  } catch (error) {
    throw new Error('Encryption failed');
  }
}

export async function decrypt(text: string): Promise<string> {
  try {
    const [ivHex, encryptedHex] = text.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const encryptedText = Buffer.from(encryptedHex, 'hex');
    const decipher = createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (error) {
    throw new Error('Decryption failed');
  }
}
