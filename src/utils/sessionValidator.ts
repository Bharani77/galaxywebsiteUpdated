export async function validateSession(sessionToken: string | null, username: string): Promise<boolean> {
  if (!sessionToken) return false;
  // Add your session validation logic here
  return true;
}
