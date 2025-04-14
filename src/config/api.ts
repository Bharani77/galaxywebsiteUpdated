import crypto from 'crypto';

// Generate a new API key if not exists
export const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || crypto.randomBytes(32).toString('hex');

export const API_CONFIG = {
  timeouts: {
    default: 10000,
    long: 30000
  },
  headers: {
    internal: {
      'X-API-Key': INTERNAL_API_KEY,
      'X-Internal-Request': 'true'
    }
  }
};
