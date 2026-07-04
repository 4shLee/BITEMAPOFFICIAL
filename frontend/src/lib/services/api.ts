const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api';

const getAuthToken = () => localStorage.getItem('bitemap_access_token');

async function apiRequest(endpoint: string, options: RequestInit = {}, requiresAuth = true) {
  const headers: HeadersInit = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const token = getAuthToken();
  if (requiresAuth && token) {
    headers.Authorization = 'Bearer ' + token;
  }

  const response = await fetch(API_BASE_URL + endpoint, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({
    success: false,
    error: 'Invalid server response',
  }));

  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem('bitemap_access_token');
      localStorage.removeItem('bitemap_user');
    }

    throw new Error(data.error || data.message || 'Request failed with status ' + response.status);
  }

  if (!data.success && data.error) {
    throw new Error(data.error);
  }

  return data;
}

// ============ AUTHENTICATION API ============
export const authAPI = {
  async signUp(email: string, password: string, fullName: string, role: string, phone?: string) {
    return apiRequest('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, fullName, role, phone }),
    }, false);
  },

  async signIn(email: string, password: string) {
    const data = await apiRequest('/auth/signin', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }, false);

    if (data.success && data.accessToken) {
      localStorage.setItem('bitemap_access_token', data.accessToken);
      localStorage.setItem('bitemap_user', JSON.stringify(data.user));
    }

    return data;
  },

  async getSession() {
    try {
      return await apiRequest('/auth/session');
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Session expired' };
    }
  },

  async signOut() {
    try {
      await apiRequest('/auth/signout', { method: 'POST' });
    } finally {
      localStorage.removeItem('bitemap_access_token');
      localStorage.removeItem('bitemap_user');
      window.location.href = '/login';
    }
  },

  getCurrentUser() {
    const userStr = localStorage.getItem('bitemap_user');
    return userStr ? JSON.parse(userStr) : null;
  }
};

// ============ DASHBOARD API ============
export const dashboardAPI = {
  async getStats() {
    return apiRequest('/dashboard/stats');
  }
};

// ============ INCIDENTS API ============
export const incidentsAPI = {
  async getAll() {
    return apiRequest('/incidents');
  },

  async getById(id: string) {
    return apiRequest('/incidents/' + id);
  },

  async create(incidentData: any) {
    return apiRequest('/incidents', {
      method: 'POST',
      body: JSON.stringify(incidentData),
    });
  },

  async update(id: string, incidentData: any) {
    return apiRequest('/incidents/' + id, {
      method: 'PUT',
      body: JSON.stringify(incidentData),
    });
  },

  async delete(id: string) {
    return apiRequest('/incidents/' + id, {
      method: 'DELETE',
    });
  }
};

// ============ PATIENTS API ============
export const patientsAPI = {
  async getAll() {
    return apiRequest('/patients');
  },

  async getById(id: string) {
    return apiRequest('/patients/' + id);
  },

  async create(patientData: any) {
    return apiRequest('/patients', {
      method: 'POST',
      body: JSON.stringify(patientData),
    });
  },

  async update(id: string, patientData: any) {
    return apiRequest('/patients/' + id, {
      method: 'PUT',
      body: JSON.stringify(patientData),
    });
  },

  async delete(id: string) {
    return apiRequest('/patients/' + id, {
      method: 'DELETE',
    });
  }
};

// ============ PEP SCHEDULE API ============
export const pepScheduleAPI = {
  async getAll() {
    return apiRequest('/pep-schedule');
  },

  async update(id: string, updateData: any) {
    return apiRequest('/pep-schedule/' + id, {
      method: 'PUT',
      body: JSON.stringify(updateData),
    });
  }
};

// ============ INVENTORY API ============
export const inventoryAPI = {
  async getAll() {
    return apiRequest('/inventory');
  },

  async create(itemData: any) {
    return apiRequest('/inventory', {
      method: 'POST',
      body: JSON.stringify(itemData),
    });
  },

  async update(id: string, stockData: any) {
    return apiRequest('/inventory/' + id, {
      method: 'PUT',
      body: JSON.stringify(stockData),
    });
  }
};

// ============ ANIMALS API ============
export const animalsAPI = {
  async getAll() {
    return apiRequest('/animals');
  },

  async create(animalData: any) {
    return apiRequest('/animals', {
      method: 'POST',
      body: JSON.stringify(animalData),
    });
  },

  async update(id: string, animalData: any) {
    return apiRequest('/animals/' + id, {
      method: 'PUT',
      body: JSON.stringify(animalData),
    });
  }
};

// ============ USERS API ============
export const usersAPI = {
  async getAll() {
    return apiRequest('/users');
  },

  async update(id: string, userData: any) {
    return apiRequest('/users/' + id, {
      method: 'PUT',
      body: JSON.stringify(userData),
    });
  },

  async approve(id: string, role?: string) {
    return apiRequest('/users/' + id + '/approve', {
      method: 'PUT',
      body: JSON.stringify({ role }),
    });
  },

  async reject(id: string) {
    return apiRequest('/users/' + id + '/reject', {
      method: 'PUT',
    });
  }
};

// ============ REPORTS API ============
export const reportsAPI = {
  async getSummary(config: any) {
    const query = new URLSearchParams({
      type: config.type,
      date_from: config.dateFrom,
      date_to: config.dateTo,
      barangay: config.barangay,
      format: config.format,
    });

    return apiRequest('/reports/summary?' + query.toString());
  },

  async download(config: any) {
    const query = new URLSearchParams({
      type: config.type,
      date_from: config.dateFrom,
      date_to: config.dateTo,
      barangay: config.barangay,
      format: config.format,
    });

    const headers: HeadersInit = {
      'Accept': config.format === 'Excel' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/pdf',
    };

    const token = getAuthToken();
    if (token) {
      headers.Authorization = 'Bearer ' + token;
    }

    const response = await fetch(API_BASE_URL + '/reports/download?' + query.toString(), { headers });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || errorData.message || 'Failed to download report.');
    }

    const disposition = response.headers.get('Content-Disposition') || '';
    const match = disposition.match(/filename="?([^";]+)"?/i);

    return {
      blob: await response.blob(),
      filename: match?.[1] || ('bitemap-report.' + (config.format === 'Excel' ? 'xlsx' : 'pdf')),
    };
  }
};

// ============ AUDIT LOGS API ============
export const auditLogsAPI = {
  async getAll(filters: Record<string, string> = {}) {
    const query = new URLSearchParams();

    Object.entries(filters).forEach(([key, value]) => {
      if (value && value !== 'All') query.set(key, value);
    });

    const suffix = query.toString() ? '?' + query.toString() : '';
    return apiRequest('/audit-logs' + suffix);
  },

  async download(filters: Record<string, string> = {}, format: 'PDF' | 'Excel' = 'PDF') {
    const query = new URLSearchParams({ ...filters, format });
    const headers: HeadersInit = {
      'Accept': format === 'Excel' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/pdf',
    };
    const token = getAuthToken();
    if (token) headers.Authorization = 'Bearer ' + token;

    const response = await fetch(API_BASE_URL + '/audit-logs/download?' + query.toString(), { headers });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || errorData.message || 'Failed to download audit logs.');
    }

    const disposition = response.headers.get('Content-Disposition') || '';
    const match = disposition.match(/filename="?([^";]+)"?/i);
    return {
      blob: await response.blob(),
      filename: match?.[1] || ('bitemap-audit-log.' + (format === 'Excel' ? 'xlsx' : 'pdf')),
    };
  }
};

// ============ SETTINGS API ============
export const settingsAPI = {
  async getAll() {
    return apiRequest('/settings');
  },

  async update(key: string, value: string) {
    return apiRequest('/settings/' + key, {
      method: 'PUT',
      body: JSON.stringify({ value }),
    });
  }
};

// ============ NOTIFICATIONS API ============
export const notificationsAPI = {
  async getAll() {
    return apiRequest('/notifications');
  },

  async getTodaySchedules() {
    return apiRequest('/schedule-alerts/today');
  },

  async sendSMS(phone: string, message: string, patientId?: string, incidentId?: string) {
    return apiRequest('/send-sms', {
      method: 'POST',
      body: JSON.stringify({ phone, message, patientId, incidentId }),
    });
  },

  async sendEmail(to: string, subject: string, message: string, patientId?: string, incidentId?: string) {
    return apiRequest('/send-email', {
      method: 'POST',
      body: JSON.stringify({ to, subject, message, patientId, incidentId }),
    });
  }
};

// ============ BARANGAYS API ============
export const barangaysAPI = {
  async getAll() {
    return apiRequest('/barangays', {}, false);
  }
};

// ============ PUBLIC API (No Auth) ============
export const publicAPI = {
  async getStatistics() {
    return apiRequest('/public/statistics', {}, false);
  },

  async getHeatmap(params: Record<string, string> = {}) {
    const query = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value && value !== 'All') {
        query.set(key, value);
      }
    });

    const suffix = query.toString() ? '?' + query.toString() : '';
    return apiRequest('/public/heatmap' + suffix, {}, false);
  },

  async getBarangayStats() {
    return apiRequest('/public/barangay-stats', {}, false);
  }
};
