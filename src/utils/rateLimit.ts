import { Redis } from '@upstash/redis';
import { NextRequest } from 'next/server';
import IPCIDR from "ip-cidr";

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

const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS = 60; // requests per window

interface RateLimitStore {
  timestamp: number;
  requests: number;
}

export async function rateLimit(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const method = request.method.toUpperCase();
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('x-real-ip') || 'anonymous';

  // Validate request method and IP
  if (!SECURITY_CONFIG.allowedMethods.includes(method)) {
    await logSecurityEvent('invalid_method', { method });
    return { success: false, limit: 0, remaining: 0, reset: 0 };
  }

  if (!ip || !isValidIp(ip)) {
    await logSecurityEvent('invalid_ip', { ip });
    return { success: false, limit: 0, remaining: 0, reset: 0 };
  }

  const endpointConfig = SECURITY_CONFIG.sensitiveEndpoints[path as keyof typeof SECURITY_CONFIG.sensitiveEndpoints];
  const config = {
    limit: endpointConfig?.maxAttempts || MAX_REQUESTS,
    windowMs: RATE_LIMIT_WINDOW
  };

  const now = Date.now();
  const key = `ratelimit:${ip}:${path}`;

  try {
    const multi = redis.pipeline();
    multi.incr(key);
    multi.expire(key, config.windowMs / 1000);
    
    const [requests] = await multi.exec();
    const remaining = Math.max(0, config.limit - (requests as number));

    return {
      success: remaining > 0,
      limit: config.limit,
      remaining,
      reset: now + config.windowMs
    };
  } catch (error) {
    console.error('Rate limit error:', error);
    // Fail open to prevent blocking legitimate traffic
    return { 
      success: true, 
      limit: config.limit,
      remaining: 1, 
      reset: now + config.windowMs 
    };
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
  const endpointConfig = SECURITY_CONFIG.sensitiveEndpoints[path as keyof typeof SECURITY_CONFIG.sensitiveEndpoints];
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
  const defaultLimits = {
    default: { limit: 100, windowMs: 60000 }, // 100 requests per minute by default
    '/api/auth': { limit: 10, windowMs: 60000 }, // 10 requests per minute for /api/auth
    '/api/sensitive': { limit: 5, windowMs: 60000 } // 5 requests per minute for /api/sensitive
  };
  const config = defaultLimits[path as keyof typeof defaultLimits] || defaultLimits.default;
  
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
  try {
    return IPCIDR.isValidAddress(ip) && !isIpInBlockedRanges(ip);
  } catch {
    return false;
  }
}

function isIpInBlockedRanges(ip: string): boolean {
  return BLOCKED_IP_RANGES.some(range => {
    try {
      const cidr = new IPCIDR(range);
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

function isHighSeverityEvent(type: string): boolean {
  const highSeverityEvents = [
    'brute_force_blocked',
    'invalid_token',
    'unauthorized_method',
    'security_breach',
    'multiple_failed_attempts'
  ];
  return highSeverityEvents.includes(type);
}

function getSeverityLevel(type: string): 'low' | 'medium' | 'high' {
  const highSeverity = ['brute_force_blocked', 'invalid_token', 'unauthorized_method'];
  const mediumSeverity = ['rate_limit_exceeded', 'invalid_request'];
  return highSeverity.includes(type) ? 'high' 
    : mediumSeverity.includes(type) ? 'medium' : 'low';
}

async function notifySecurityTeam(event: any) {
  // Implement security notification logic
  console.error('Security Alert:', event);
  // Add your notification logic here (e.g., send to a logging service)
}

function getClientIp(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0].trim();
  const realIp = request.headers.get('x-real-ip');
  const ip = (forwarded || realIp || '').replace(/[^a-zA-Z0-9.:]/g, '');
  return ip || null;
}

async function logSecurityEvent(type: string, data: any): Promise<void> {
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
      .expire('security_events', 7 * 24 * 60 * 60)
      .exec();

    if (isHighSeverityEvent(type)) {
      await notifySecurityTeam(event);
    }
  } catch (error) {
    console.error('Security event logging failed:', error);
  }
}

