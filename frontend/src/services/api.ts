import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

let authStoreRef: {
  getState: () => { accessToken: string | null; refreshToken: string | null; setTokens: (a: string, r: string) => void; logout: () => void };
} | null = null;

export const setAuthStore = (store: typeof authStoreRef) => {
  authStoreRef = store;
};

const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor: attach token
api.interceptors.request.use((config) => {
  const token = authStoreRef?.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: handle 401 / token refresh
let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token!)));
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers = { ...originalRequest.headers, Authorization: `Bearer ${token}` };
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = authStoreRef?.getState().refreshToken;
      if (!refreshToken) {
        authStoreRef?.getState().logout();
        return Promise.reject(error);
      }

      try {
        const response = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken });
        const { accessToken, refreshToken: newRefreshToken } = response.data.data;
        authStoreRef?.getState().setTokens(accessToken, newRefreshToken);
        processQueue(null, accessToken);
        originalRequest.headers = { ...originalRequest.headers, Authorization: `Bearer ${accessToken}` };
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        authStoreRef?.getState().logout();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
