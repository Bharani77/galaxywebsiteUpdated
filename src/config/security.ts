interface SecurityConfig {
  maxRequestSize: number;
  headers: {
    allowedOrigins: string[];
    allowedMethods: string[];
  };
}

export const SECURITY_CONFIG: SecurityConfig = {
  maxRequestSize: 1024 * 1024 * 5, // 5MB
  headers: {
    allowedOrigins: ['https://galaxykicklock.web.app'],
    allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
  }
};
