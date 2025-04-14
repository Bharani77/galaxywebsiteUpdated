const executeQuery = async (params: {
  table: string;
  action: 'select' | 'update';
  query: any;
  data?: any;
}) => {
  try {
    const response = await fetch('/api/db', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      throw new Error('Database query failed');
    }

    return await response.json();
  } catch (error) {
    console.error('Database error:', error);
    throw error;
  }
};

export const db = {
  select: async (table: string, field: string, value: any, select: string) => {
    return executeQuery({
      table,
      action: 'select',
      query: { field, value, select }
    });
  },
  update: async (table: string, field: string, value: any, data: any) => {
    return executeQuery({
      table,
      action: 'update',
      query: { field, value },
      data
    });
  }
};
