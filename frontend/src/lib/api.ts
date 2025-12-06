import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  login: async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password });
    return response.data;
  },
  
  register: async (email: string, password: string, name?: string) => {
    const response = await api.post('/auth/register', { email, password, name });
    return response.data;
  },
  
  me: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },
};

// Analytics API
export const analyticsApi = {
  getSummary: async () => {
    const response = await api.get('/analytics/summary');
    return response.data;
  },
  
  getOrdersByDate: async (startDate?: string, endDate?: string, granularity = 'day') => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    params.append('granularity', granularity);
    const response = await api.get(`/analytics/orders-by-date?${params}`);
    return response.data;
  },
  
  getTopCustomers: async (limit = 5) => {
    const response = await api.get(`/analytics/top-customers?limit=${limit}`);
    return response.data;
  },
  
  getRevenueTrend: async (days = 30) => {
    const response = await api.get(`/analytics/revenue-trend?days=${days}`);
    return response.data;
  },
  
  getTopProducts: async (limit = 10) => {
    const response = await api.get(`/analytics/top-products?limit=${limit}`);
    return response.data;
  },
  
  getOrderStatus: async () => {
    const response = await api.get('/analytics/order-status');
    return response.data;
  },
  
  getAbandonedCarts: async () => {
    const response = await api.get('/analytics/abandoned-carts');
    return response.data;
  },
  
  getCustomerAcquisition: async (days = 30) => {
    const response = await api.get(`/analytics/customer-acquisition?days=${days}`);
    return response.data;
  },
  
  getAovTrend: async (days = 30) => {
    const response = await api.get(`/analytics/aov-trend?days=${days}`);
    return response.data;
  },
};

// Customers API
export const customersApi = {
  getAll: async (page = 1, limit = 20, search = '') => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (search) params.append('search', search);
    const response = await api.get(`/customers?${params}`);
    return response.data;
  },
  
  getById: async (id: string) => {
    const response = await api.get(`/customers/${id}`);
    return response.data;
  },
};

// Orders API
export const ordersApi = {
  getAll: async (page = 1, limit = 20, filters: Record<string, string> = {}) => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit), ...filters });
    const response = await api.get(`/orders?${params}`);
    return response.data;
  },
  
  getById: async (id: string) => {
    const response = await api.get(`/orders/${id}`);
    return response.data;
  },
};

// Products API
export const productsApi = {
  getAll: async (page = 1, limit = 20, search = '') => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (search) params.append('search', search);
    const response = await api.get(`/products?${params}`);
    return response.data;
  },
  
  getById: async (id: string) => {
    const response = await api.get(`/products/${id}`);
    return response.data;
  },
};

// Shopify API
export const shopifyApi = {
  getStatus: async () => {
    const response = await api.get('/shopify/status');
    return response.data;
  },
  
  getAuthUrl: async (shop: string) => {
    const response = await api.get(`/shopify/auth?shop=${encodeURIComponent(shop)}`);
    return response.data;
  },
  
  disconnect: async () => {
    const response = await api.post('/shopify/disconnect');
    return response.data;
  },
  
  triggerSync: async () => {
    const response = await api.post('/shopify/sync');
    return response.data;
  },
  
  triggerFullSync: async () => {
    const response = await api.post('/shopify/sync/full');
    return response.data;
  },
  
  triggerIncrementalSync: async () => {
    const response = await api.post('/shopify/sync/incremental');
    return response.data;
  },
  
  getSyncStatus: async () => {
    const response = await api.get('/shopify/sync/status');
    return response.data;
  },
  
  getSyncHistory: async (page = 1, limit = 10) => {
    const response = await api.get(`/shopify/sync/history?page=${page}&limit=${limit}`);
    return response.data;
  },
};

// Tenant API
export const tenantApi = {
  getCurrent: async () => {
    const response = await api.get('/tenants/current');
    return response.data;
  },
  
  getSettings: async () => {
    const response = await api.get('/tenants/settings');
    return response.data;
  },
  
  updateSettings: async (settings: { name?: string; shopifyDomain?: string; shopifyAccessToken?: string; syncEnabled?: boolean }) => {
    const response = await api.put('/tenants/settings', settings);
    return response.data;
  },
  
  getSyncLogs: async (page = 1, limit = 20) => {
    const response = await api.get(`/tenants/sync-logs?page=${page}&limit=${limit}`);
    return response.data;
  },
};

export default api;
