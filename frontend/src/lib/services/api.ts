import {
  AUTH_EXPIRES_AT_STORAGE_KEY,
  AUTH_TIMEOUT_MINUTES_STORAGE_KEY,
  AUTH_TOKEN_STORAGE_KEY,
  AUTH_USER_STORAGE_KEY,
  clearAuthSessionStorage,
  getStoredUser,
  hasAuthSession,
  recordUserActivity,
} from '../auth/roleAccess';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api';

const getAuthToken = () => {
  if (!hasAuthSession()) {
    return null;
  }

  return localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
};

export class ApiError extends Error {
  status: number;
  errors: Record<string, string[]>;
  retryAfter?: number;

  constructor(
    message: string,
    status: number,
    errors: Record<string, string[]> = {},
    retryAfter?: number,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors;
    this.retryAfter = retryAfter;
  }
}

function isPassiveEndpoint(endpoint: string, customHeaders: Record<string, string>): boolean {
  if (
    customHeaders['X-Background-Poll'] === '1' ||
    customHeaders['X-Session-Check'] === '1' ||
    customHeaders['X-Passive-Request'] === '1'
  ) {
    return true;
  }

  const cleanPath = endpoint.split('?')[0];
  return (
    cleanPath === '/auth/session' ||
    cleanPath === '/auth/signout' ||
    cleanPath === '/notifications/summary'
  );
}

function syncSessionMetadata(data: Record<string, unknown>, isPassiveRequest = false) {
  if (typeof data.expiresAt === 'string' && data.expiresAt.trim() !== '') {
    localStorage.setItem(AUTH_EXPIRES_AT_STORAGE_KEY, data.expiresAt);
  }

  if (typeof data.sessionTimeoutMinutes === 'number' && Number.isFinite(data.sessionTimeoutMinutes) && data.sessionTimeoutMinutes > 0) {
    localStorage.setItem(AUTH_TIMEOUT_MINUTES_STORAGE_KEY, String(Math.round(data.sessionTimeoutMinutes)));
  }

  if (!isPassiveRequest) {
    recordUserActivity();
  }
}

async function apiRequest(endpoint: string, options: RequestInit = {}, requiresAuth = true) {
  const customHeaders = (options.headers || {}) as Record<string, string>;
  const isPassiveRequest = isPassiveEndpoint(endpoint, customHeaders);

  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    ...customHeaders,
  };

  if (requiresAuth) {
    const token = getAuthToken();
    if (!token) {
      clearAuthSessionStorage();
      throw new ApiError('Unauthenticated.', 401);
    }
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
    if (
      response.status === 401 ||
      (response.status === 403 && data?.error === 'Your account is inactive or not approved.')
    ) {
      clearAuthSessionStorage();
    }

    const retryHeader = Number(response.headers.get('Retry-After'));
    const retryAfter = typeof data?.retry_after === 'number'
      ? data.retry_after
      : (Number.isFinite(retryHeader) && retryHeader > 0 ? retryHeader : undefined);

    throw new ApiError(
      data.error || data.message || 'Request failed with status ' + response.status,
      response.status,
      data.errors || {},
      retryAfter,
    );
  }

  if (!data.success && data.error) {
    throw new Error(data.error);
  }

  if (requiresAuth) {
    syncSessionMetadata(data, isPassiveRequest);
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

export type NotificationSummaryMeta = {
  sms_service: {
    enabled: boolean;
    mode: 'enabled' | 'simulation';
    provider: string | null;
  };
  summary: {
    overdue_patients: number;
    failed_sms: number;
    due_today_patients: number;
    pending_sms: number;
  };
  priority_alert: {
    category: string | null;
    count: number;
  };
};

type BarangayListResponse = {
  success: boolean;
  data: BarangayListItem[];
};

let barangayListRequest: Promise<BarangayListResponse> | null = null;

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
      localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, data.accessToken);
      localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(data.user));
      syncSessionMetadata(data, false);
    }

    return data;
  },

  async getSession() {
    try {
      const data = await apiRequest('/auth/session', {
        headers: { 'X-Session-Check': '1' },
      });
      if (data.success && data.user) {
        localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(data.user));
        syncSessionMetadata(data, true);
      }
      return data;
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Session expired' };
    }
  },

  async signOut() {
    try {
      if (localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)) {
        await apiRequest('/auth/signout', { method: 'POST' });
      }
    } catch {
      // Clear local session regardless of server response.
    } finally {
      clearAuthSessionStorage();
      window.location.href = '/login';
    }
  },

  getCurrentUser() {
    return getStoredUser();
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
  async getAll(signal?: AbortSignal) {
    return apiRequest('/pep-schedule', { signal });
  },

  async getDoseInventoryOptions(signal?: AbortSignal) {
    return apiRequest('/pep-schedule/dose-inventory-options', { signal });
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

  async delete(id: string) {
    return apiRequest('/inventory/' + id, {
      method: 'DELETE',
    });
  },

  async deleteBatch(inventoryId: string, batchId: string) {
    return apiRequest('/inventory/' + inventoryId + '/batches/' + batchId, {
      method: 'DELETE',
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

    const headers: Record<string, string> = {
      'Accept': config.format === 'Excel' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/pdf',
    };

    const token = getAuthToken();
    if (!token) {
      clearAuthSessionStorage();
      throw new ApiError('Unauthenticated.', 401);
    }
    headers.Authorization = 'Bearer ' + token;

    const response = await fetch(API_BASE_URL + '/reports/download?' + query.toString(), { headers });

    if (!response.ok) {
      if (response.status === 401) {
        clearAuthSessionStorage();
      }
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || errorData.message || 'Failed to download report.');
    }

    recordUserActivity();

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
  async getAll(filters: Record<string, string | number> = {}, options?: { backgroundPoll?: boolean }) {
    const query = new URLSearchParams();

    Object.entries(filters).forEach(([key, value]) => {
      if (value && value !== 'All') query.set(key, String(value));
    });

    const suffix = query.toString() ? '?' + query.toString() : '';
    const requestOptions: RequestInit = options?.backgroundPoll
      ? { headers: { 'X-Background-Poll': '1' } }
      : {};

    return apiRequest('/audit-logs' + suffix, requestOptions);
  },

  async download(filters: Record<string, string | number> = {}, format: 'PDF' | 'Excel' = 'PDF') {
    const query = new URLSearchParams();
    Object.entries({ ...filters, format }).forEach(([key, value]) => {
      if (value && value !== 'All') query.set(key, String(value));
    });
    const headers: Record<string, string> = {
      'Accept': format === 'Excel' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/pdf',
    };
    const token = getAuthToken();
    if (!token) {
      clearAuthSessionStorage();
      throw new ApiError('Unauthenticated.', 401);
    }
    headers.Authorization = 'Bearer ' + token;

    const response = await fetch(API_BASE_URL + '/audit-logs/download?' + query.toString(), { headers });
    if (!response.ok) {
      if (response.status === 401) {
        clearAuthSessionStorage();
      }
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || errorData.message || 'Failed to download audit logs.');
    }

    recordUserActivity();

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
    const response = await apiRequest('/settings/' + key, {
      method: 'PUT',
      body: JSON.stringify({ value }),
    });

    if (key === 'session_timeout_minutes') {
      const numeric = Number(value);
      if (Number.isFinite(numeric) && numeric > 0) {
        localStorage.setItem(AUTH_TIMEOUT_MINUTES_STORAGE_KEY, String(Math.round(numeric)));
      }
    }

    return response;
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

  async getSummary(options?: { backgroundPoll?: boolean }): Promise<{ success: boolean; meta: NotificationSummaryMeta }> {
    const isBackground = options?.backgroundPoll ?? true;
    const requestOptions: RequestInit = isBackground
      ? { headers: { 'X-Background-Poll': '1' } }
      : {};

    return apiRequest('/notifications/summary', requestOptions);
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
  async getAll(): Promise<BarangayListResponse> {
    if (!barangayListRequest) {
      barangayListRequest = apiRequest('/barangays', {}, false)
        .catch((error: unknown) => {
          barangayListRequest = null;
          throw error;
        });
    }

    return barangayListRequest;
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

// ============ GLOBAL SEARCH API ============
export interface GlobalSearchResultItem {
  id?: number | string;
  title: string;
  subtitle?: string;
  contact?: string | null;
  url: string;
}

export interface GlobalSearchResponse {
  success: boolean;
  data: {
    patients: GlobalSearchResultItem[];
    incidents: GlobalSearchResultItem[];
    pep_schedules: GlobalSearchResultItem[];
    inventory: GlobalSearchResultItem[];
    users: GlobalSearchResultItem[];
    navigation: GlobalSearchResultItem[];
  };
}

export const searchAPI = {
  async globalSearch(query: string, signal?: AbortSignal): Promise<GlobalSearchResponse> {
    return apiRequest('/global-search?query=' + encodeURIComponent(query), { signal });
  },
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
