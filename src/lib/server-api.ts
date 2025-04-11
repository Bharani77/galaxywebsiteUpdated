import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const EXTERNAL_APIS = {
  DEPLOY: process.env.DEPLOY_API_URL!,
  UNDEPLOY: process.env.UNDEPLOY_API_URL!,
  STATUS: process.env.STATUS_API_URL!,
  REPO: process.env.REPO_URL!,
  BASE_MODAL: process.env.MODAL_API_BASE_URL!
};

export class ServerAPI {
  static async validateToken(token: string): Promise<{ valid: boolean; expired?: boolean }> {
    const { data, error } = await supabase
      .from('tokengenerate')
      .select('status, expiresat')
      .eq('token', token)
      .single();

    if (error || !data) return { valid: false };
    if (['Invalid', 'N/A'].includes(data.status)) return { valid: false };
    if (data.expiresat && new Date(data.expiresat) < new Date()) {
      return { valid: false, expired: true };
    }
    return { valid: true };
  }

  static async deployModel(username: string): Promise<boolean> {
    try {
      const response = await fetch(EXTERNAL_APIS.DEPLOY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repo_url: EXTERNAL_APIS.REPO,
          modal_name: username
        })
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  static async undeployModel(username: string): Promise<boolean> {
    try {
      const response = await fetch(EXTERNAL_APIS.UNDEPLOY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modal_name: username })
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  static async checkModelStatus(username: string): Promise<{ deployed: boolean }> {
    try {
      const response = await fetch(EXTERNAL_APIS.STATUS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modal_name: username })
      });
      const data = await response.json();
      return { deployed: data.status === "deployed" };
    } catch {
      return { deployed: false };
    }
  }

  static async performAction(action: string, formNumber: string, username: string, data: any): Promise<boolean> {
    try {
      const baseUrl = EXTERNAL_APIS.BASE_MODAL.replace('{username}', username);
      const response = await fetch(`${baseUrl}/${action}/${formNumber}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}