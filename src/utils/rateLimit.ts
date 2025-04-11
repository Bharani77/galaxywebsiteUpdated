import { Redis } from '@upstash/redis';
import { NextRequest } from 'next/server';
import { parse as parseCIDR, isIPv4 } from 'ip-cidr';

// Environment validation
if (!process.env.REDIS_URL || !process.env.REDIS_TOKEN) {
  throw new Error('Missing required Redis configuration');
}

const SECURITY_CONFIG = {
  maxFailedAttempts: 5,
  blockDuration: 3600, // 1 hour in seconds
  requestTimeout: 5000, // 5 seconds
  maxRequestSize: '100kb',
  allowedMethods: ['GET', 'POST', 'PUT', 'DELETE'],
  sensitiveEndpoints: {
    '/api/auth': { methods: ['POST'], maxAttempts: 5 },
    '/api/sensitive': { methods: ['GET'], maxAttempts: 10 }
  }
};

// Add more blocked ranges and specify exact CIDR notation
const BLOCKED_IP_RANGES = [
  '0.0.0.0/8',
  '100.64.0.0/10',
  '127.0.0.0/8',
  '169.254.0.0/16',
  '192.0.2.0/24',
  '224.0.0.0/4',
];

const redis = new Redis({
  url: process.env.REDIS_URL || '',
  token: process.env.REDIS_TOKEN || '',
});

export async function rateLimit(request: Request) {
  const startTime = Date.now();
  
  // Timeout protection
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Request timeout')), SECURITY_CONFIG.requestTimeout);
  });

  try {
    return await Promise.race([rateLimitImpl(request), timeoutPromise]);
  } catch (error) {
    await logSecurityEvent('rate_limit_error', { error, ip: getClientIp(request) });
    return { success: false, reason: 'security_error' };
  }
}

async function rateLimitImpl(request: Request) {
  // Validate request method
  const method = request.method.toUpperCase();
  if (!SECURITY_CONFIG.allowedMethods.includes(method)) {
    await logSecurityEvent('invalid_method', { method });
    return { success: false, reason: 'method_not_allowed' };
  }

  // Validate endpoint-specific restrictions
  const path = new URL(request.url).pathname;
  const endpointConfig = SECURITY_CONFIG.sensitiveEndpoints[path];
  if (endpointConfig && !endpointConfig.methods.includes(method)) {
    await logSecurityEvent('unauthorized_method', { path, method });
    return { success: false, reason: 'unauthorized_method' };
  }

  // Check for brute force attempts
  const ip = getClientIp(request);
  if (ip) {
    const bruteForceKey = `bruteforce:${ip}:${path}`;
    const attempts = await redis.incr(bruteForceKey);
    await redis.expire(bruteForceKey, SECURITY_CONFIG.blockDuration);

    const maxAttempts = endpointConfig?.maxAttempts || SECURITY_CONFIG.maxFailedAttempts;
    if (attempts > maxAttempts) {
      await logSecurityEvent('brute_force_blocked', { ip, path, attempts });
      return { success: false, reason: 'blocked_brute_force' };
    }
  }

  if (!isValidRequest(request)) {
    await logSecurityEvent('invalid_request', { headers: Object.fromEntries(request.headers) });
    return { success: false, reason: 'invalid_request' };
  }

  if (!ip || !isValidIp(ip)) {
    await logSecurityEvent('invalid_ip', { ip });
    return { success: false, reason: 'invalid_ip' };
  }

  const url = new URL(request.url);
  const config = defaultLimits[path] || defaultLimits.default;
  
  const now = Date.now();
  const key = `ratelimit:${ip}:${path}`;
  
  try {
    const multi = redis.pipeline();
    multi.incr(key);
    multi.expire(key, config.windowMs / 1000);
    
    // Add failed attempts tracking
    const failKey = `ratelimit:fail:${ip}`;
    multi.get(failKey);
    
    const [requests, _, fails] = await multi.exec();
    
    // Block if too many failed attempts
    if (Number(fails) >= 10) {
      return { success: false, reason: 'too_many_fails' };
    }

    const remaining = Math.max(0, config.limit - (requests as number));
    
    return {
      success: remaining > 0,
      remaining,
      reset: now + config.windowMs,
      limit: config.limit
    };
  } catch (error) {
    console.error('Rate limit error:', error);
    return { success: true, remaining: 1, reset: now + config.windowMs };
  }
}

function isValidIp(ip: string): boolean {
  return isIPv4(ip) && !isIpInBlockedRanges(ip);
}

function isIpInBlockedRanges(ip: string): boolean {
  return BLOCKED_IP_RANGES.some(range => {
    try {
      const cidr = parseCIDR(range);
      return cidr.contains(ip);
    } catch {
      console.error(`Invalid CIDR range: ${range}`);
      return false;
    }
  });
}

function isValidRequest(request: Request): boolean {
  const required = ['host', 'user-agent'];
  const suspicious = ['x-forwarded-host', 'x-host'];
  
  // Check required headers
  if (!required.every(header => request.headers.has(header))) {
    return false;
  }
  
  // Check for suspicious headers
  if (suspicious.some(header => request.headers.has(header))) {
    return false;
  }
  
  // Validate User-Agent
  const ua = request.headers.get('user-agent') || '';
  if (ua.length < 5 || ua.length > 255) {
    return false;
  }

  return true;
}

async function logSecurityEvent(type: string, data: any) {
  const event = {
    type,
    timestamp: new Date().toISOString(),
    data,
    severity: getSeverityLevel(type),
    environment: process.env.NODE_ENV
  };

  try {
    await redis
      .pipeline()
      .lpush('security_events', JSON.stringify(event))
      .ltrim('security_events', 0, 999)
      .expire('security_events', 7 * 24 * 60 * 60) // 7 days retention
      .exec();
      
    if (isHighSeverityEvent(type)) {
      await notifySecurityTeam(event);
    }
  } catch (error) {
    console.error('Security event logging failed:', error);
  }
}

function getSeverityLevel(type: string): 'low' | 'medium' | 'high' {
  const highSeverity = ['brute_force_blocked', 'invalid_token', 'unauthorized_method'];
  const mediumSeverity = ['rate_limit_exceeded', 'invalid_request'];
  return highSeverity.includes(type) ? 'high' 
    : mediumSeverity.includes(type) ? 'medium' : 'low';
}

async function notifySecurityTeam(event: any) {
  // Implement security notification logic
  // This is a placeholder for implementing real notifications
  console.error('Security Alert:', event);
}

function getClientIp(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0].trim();
  const realIp = request.headers.get('x-real-ip');
  const ip = (forwarded || realIp || '').replace(/[^a-zA-Z0-9.:]/g, '');
  return ip || null;
}
