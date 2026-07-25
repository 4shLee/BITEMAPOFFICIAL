const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api';

const getAuthToken = () => localStorage.getItem('bitemap_access_token');

export class ApiError extends Error {
  status: number;
  errors: Record<string, string[]>;

  constructor(message: string, status: number, errors: Record<string, string[]> = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors;
  }
}

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

    throw new ApiError(
      data.error || data.message || 'Request failed with status ' + response.status,
      response.status,
      data.errors || {},
    );
  }

  if (!data.success && data.error) {
    throw new Error(data.error);
  }

  return data;
}

export function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

async function publicApiRequest(endpoint: string) {
  try {
    return await apiRequest(endpoint, {}, false);
  } catch {
    throw new Error('Public data is temporarily unavailable.');
  }
}

export type RegistryListFilters = {
  page?: number;
  per_page?: 10 | 20 | 25 | 50;
  search?: string;
  status?: string;
  barangay_id?: string | number;
};

export type RegistryPagination = {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from: number | null;
  to: number | null;
};

export type RegistryListResponse<T> = {
  success: boolean;
  data: T[];
  pagination: RegistryPagination;
};

export type BarangayListItem = {
  id: number | string;
  name: string;
  latitude?: number | string | null;
  longitude?: number | string | null;
};

export type RegistryPatient = {
  id: number | string;
  first_name?: string | null;
  middle_name?: string | null;
  last_name?: string | null;
  suffix?: string | null;
  full_name?: string | null;
  display_name?: string | null;
  age?: number | string | null;
  sex?: string | null;
  residence_barangay?: string | null;
  barangay_id?: number | string | null;
  barangay?: BarangayListItem | null;
  contact_number?: string | null;
  created_at?: string | null;
};

export type RegistryIncident = {
  id: number | string;
  patient_id: number | string;
  patient?: RegistryPatient | null;
  contact_number?: string | null;
  barangay_id?: number | string | null;
  barangay?: BarangayListItem | null;
  incident_date?: string | null;
  animal_type?: string | null;
  bite_site?: string | null;
  bite_location?: string | null;
  who_category?: string | null;
  status?: string | null;
  pep_schedules_count: number;
  completed_pep_schedules_count: number;
};

export type ApiPayload = Record<string, unknown>;

export type ReportConfig = {
  type: string;
  dateFrom: string;
  dateTo: string;
  barangay: string;
  format: 'PDF' | 'Excel';
};

function registryListEndpoint(endpoint: string, filters: RegistryListFilters = {}) {
  const query = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '' && value !== 'All') {
      query.set(key, String(value));
    }
  });

  return endpoint + (query.size > 0 ? '?' + query.toString() : '');
}

// ============ AUTHENTICATION API ============
export const authAPI = {
  async signUp(email: string, password: string, name: { firstName: string; middleName?: string; lastName: string; suffix?: string }, role: string, phone?: string) {
    const normalize = (value?: string) => String(value || '').trim().replace(/\s+/g, ' ');
    const firstName = normalize(name.firstName);
    const middleName = normalize(name.middleName);
    const lastName = normalize(name.lastName);
    const suffix = normalize(name.suffix);
    const fullName = [firstName, middleName, lastName, suffix].filter(Boolean).join(' ');

    return apiRequest('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({
        email,
        password,
        first_name: firstName,
        middle_name: middleName || null,
        last_name: lastName,
        suffix: suffix || null,
        full_name: fullName,
        role,
        phone,
      }),
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
  async getAll(filters: RegistryListFilters, signal?: AbortSignal): Promise<RegistryListResponse<RegistryIncident>> {
    return apiRequest(registryListEndpoint('/incidents', filters), { signal });
  },

  async getById(id: string) {
    return apiRequest('/incidents/' + id);
  },

  async create(incidentData: ApiPayload) {
    return apiRequest('/incidents', {
      method: 'POST',
      body: JSON.stringify(incidentData),
    });
  },

  async update(id: string, incidentData: ApiPayload) {
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
  async getAll(filters: RegistryListFilters, signal?: AbortSignal): Promise<RegistryListResponse<RegistryPatient>> {
    return apiRequest(registryListEndpoint('/patients', filters), { signal });
  },

  async getById(id: string) {
    return apiRequest('/patients/' + id);
  },

  async create(patientData: ApiPayload) {
    return apiRequest('/patients', {
      method: 'POST',
      body: JSON.stringify(patientData),
    });
  },

  async update(id: string, patientData: ApiPayload) {
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

  async update(id: string, updateData: ApiPayload) {
    return apiRequest('/pep-schedule/' + id, {
      method: 'PUT',
      body: JSON.stringify(updateData),
    });
  },

  async recordDose(id: string, doseData: {
    administered_date: string;
    administration_route: 'Intradermal' | 'Intramuscular';
    inventory_id: number;
    inventory_batch_id: number;
    remarks?: string;
  }) {
    return apiRequest('/pep-schedule/' + id + '/record-dose', {
      method: 'POST',
      body: JSON.stringify(doseData),
    });
  },

  async reschedule(id: string, scheduledDate: string, reason: string) {
    return apiRequest('/pep-schedule/' + id + '/reschedule', {
      method: 'PUT',
      body: JSON.stringify({ scheduled_date: scheduledDate, reason }),
    });
  }
};

// ============ INVENTORY API ============
export const inventoryAPI = {
  async getAll() {
    return apiRequest('/inventory');
  },

  async create(itemData: ApiPayload) {
    return apiRequest('/inventory', {
      method: 'POST',
      body: JSON.stringify(itemData),
    });
  },

  async update(id: string, stockData: ApiPayload) {
    return apiRequest('/inventory/' + id, {
      method: 'PUT',
      body: JSON.stringify(stockData),
    });
  },

  async getBatches(id: string) {
    return apiRequest('/inventory/' + id + '/batches');
  },

  async addBatch(id: string, batchData: ApiPayload) {
    return apiRequest('/inventory/' + id + '/batches', {
      method: 'POST',
      body: JSON.stringify(batchData),
    });
  }
};

// ============ ANIMALS API ============
export const animalsAPI = {
  async getAll() {
    return apiRequest('/animals');
  },

  async create(animalData: ApiPayload) {
    return apiRequest('/animals', {
      method: 'POST',
      body: JSON.stringify(animalData),
    });
  },

  async update(id: string, animalData: ApiPayload) {
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

  async update(id: string, userData: ApiPayload) {
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
  async getSummary(config: ReportConfig) {
    const query = new URLSearchParams({
      type: config.type,
      date_from: config.dateFrom,
      date_to: config.dateTo,
      barangay: config.barangay,
      format: config.format,
    });

    return apiRequest('/reports/summary?' + query.toString());
  },

  async download(config: ReportConfig) {
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
  async getAll(filters: Record<string, string | number> = {}) {
    const query = new URLSearchParams();

    Object.entries(filters).forEach(([key, value]) => {
      if (value && value !== 'All') query.set(key, String(value));
    });

    const suffix = query.toString() ? '?' + query.toString() : '';
    return apiRequest('/audit-logs' + suffix);
  },

  async download(filters: Record<string, string | number> = {}, format: 'PDF' | 'Excel' = 'PDF') {
    const query = new URLSearchParams();
    Object.entries({ ...filters, format }).forEach(([key, value]) => {
      if (value && value !== 'All') query.set(key, String(value));
    });
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
  },

  async updateSmsCredentials(credentials: { account_sid: string; auth_token: string; from_number: string }) {
    return apiRequest('/settings/sms-credentials', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  },

  async testSms(payload: { phone: string; message: string }) {
    return apiRequest('/settings/test-sms', {
      method: 'POST',
      body: JSON.stringify(payload),
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

  async sendSMS(
    phone: string,
    message: string,
    patientId?: string,
    incidentId?: string,
    reminder?: {
      pepScheduleId?: string;
      reminderType?: string;
      scheduledDate?: string;
      retryNotificationId?: string;
    },
  ) {
    return apiRequest('/send-sms', {
      method: 'POST',
      body: JSON.stringify({ phone, message, patientId, incidentId, ...reminder }),
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

export const gisAPI = {
  async getHeatmap(params: Record<string, string> = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value && value !== 'All') query.set(key, value);
    });
    const suffix = query.toString() ? '?' + query.toString() : '';
    return apiRequest('/gis/heatmap' + suffix);
  }
};

// ============ PUBLIC API (No Auth) ============
export const publicAPI = {
  async getStatistics() {
    return publicApiRequest('/public/statistics');
  },

  async getHeatmap(params: Record<string, string> = {}) {
    const query = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value && value !== 'All') {
        query.set(key, value);
      }
    });

    const suffix = query.toString() ? '?' + query.toString() : '';
    return publicApiRequest('/public/heatmap' + suffix);
  },

  async getBarangayStats() {
    return publicApiRequest('/public/barangay-stats');
  },

  async getClinics() {
    return publicApiRequest('/public/clinics');
  }
};
