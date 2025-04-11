export const API_ROUTES = {
  DEPLOY: '/api/deploy',
  UNDEPLOY: '/api/undeploy',
  STATUS: '/api/status',
  ACTIONS: '/api/actions'
} as const;

export const ERROR_MESSAGES = {
  UNAUTHORIZED: 'Session expired or invalid',
  TOKEN_EXPIRED: 'Token has expired',
  DEPLOY_LIMIT: 'Maximum deployments reached for today',
  DEPLOY_FAILED: 'Deployment failed',
  UNDEPLOY_FAILED: 'Undeployment failed',
  SESSION_EXPIRED: 'Session expired due to inactivity'
} as const;