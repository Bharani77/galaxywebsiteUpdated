import { NextRequest } from 'next/server';

export interface RateLimitInfo {
  count: number;
  timestamp: number;
}

export class SecurityUtils {
  private static rateLimitMap = new Map<string, RateLimitInfo>();
  private static readonly RATE_LIMIT_DURATION = 60 * 1000; // 1 minute
  private static readonly MAX_REQUESTS = 100; // Max requests per minute

  static checkRateLimit(request: NextRequest): boolean {
    const ip = request.ip || 'anonymous';
    const now = Date.now();
    const rateLimit = this.rateLimitMap.get(ip);

    if (rateLimit) {
      if (now - rateLimit.timestamp < this.RATE_LIMIT_DURATION) {
        if (rateLimit.count >= this.MAX_REQUESTS) {
          return false;
        }
        rateLimit.count++;
      } else {
        rateLimit.count = 1;
        rateLimit.timestamp = now;
      }
    } else {
      this.rateLimitMap.set(ip, { count: 1, timestamp: now });
    }
    return true;
  }

  static validateUserAgent(userAgent: string): boolean {
    const lowerUA = userAgent.toLowerCase();
    const isBadBot = lowerUA.match(/(bot|script|curl|wget|phantom|headless)/gi);
    const isAllowedBot = lowerUA.match(/(googlebot|bingbot)/gi);
    return !(isBadBot && !isAllowedBot);
  }

  static getSecurityHeaders(): Record<string, string> {
    return {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
      'Content-Security-Policy': [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data: https:",
        "connect-src 'self' https://*.supabase.co https://buddymaster77hugs-gradio.hf.space",
        "frame-ancestors 'none'",
        "form-action 'self'",
        "upgrade-insecure-requests"
      ].join('; ')
    };
  }
}

export const sanitizeInput = (input: string): string => {
  return input.replace(/[<>{}]/g, '');
};

export const validatePassword = (password: string): boolean => {
  // At least 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  return passwordRegex.test(password);
};

export const validateUsername = (username: string): boolean => {
  // Alphanumeric and underscore only, 3-20 chars
  const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
  return usernameRegex.test(username);
};

export const generateSecureToken = (): string => {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
};

export const isValidSessionId = (sessionId: string): boolean => {
  // UUID format validation
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(sessionId);
};
