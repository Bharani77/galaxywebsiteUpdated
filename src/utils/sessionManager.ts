import { generateSecureToken } from './securityUtils';

const SESSION_DURATION = 3600000; // 1 hour in milliseconds

export class SessionManager {
  private static sessions = new Map<string, { timestamp: number, userId: string }>();

  static createSession(userId: string): string {
    const token = generateSecureToken();
    this.sessions.set(token, {
      timestamp: Date.now(),
      userId
    });
    return token;
  }

  static validateSession(token: string): boolean {
    const session = this.sessions.get(token);
    if (!session) return false;

    const isExpired = Date.now() - session.timestamp > SESSION_DURATION;
    if (isExpired) {
      this.sessions.delete(token);
      return false;
    }

    // Refresh session timestamp
    session.timestamp = Date.now();
    return true;
  }

  static clearSession(token: string): void {
    this.sessions.delete(token);
  }

  // Cleanup expired sessions periodically
  static initCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      for (const [token, session] of this.sessions.entries()) {
        if (now - session.timestamp > SESSION_DURATION) {
          this.sessions.delete(token);
        }
      }
    }, 300000); // Run every 5 minutes
  }
}

// Initialize cleanup
SessionManager.initCleanup();
