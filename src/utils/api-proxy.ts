class APIProxy {
  private static async makeRequest(endpoint: string, method: string, data?: any) {
    const url = `/api/${endpoint}`;
    try {
      const sessionToken = sessionStorage.getItem('sessionToken');
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: data ? JSON.stringify(data) : undefined
      });
      
      return await response.json();
    } catch (error) {
      return { success: false };
    }
  }

  static async deploy(username: string) {
    return this.makeRequest('deploy', 'POST', { modal_name: username });
  }

  static async undeploy(username: string) {
    return this.makeRequest('undeploy', 'POST', { modal_name: username });
  }

  static async checkStatus(username: string) {
    return this.makeRequest('status', 'POST', { modal_name: username });
  }

  static async performAction(action: string, formNumber: string, username: string, data: any) {
    return this.makeRequest(`actions/${action}/${formNumber}`, 'POST', { username, data });
  }
}

export default APIProxy;