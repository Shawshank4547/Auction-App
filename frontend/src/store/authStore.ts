import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '../types';
import api, { setAuthStore } from '../services/api';
import socketService from '../services/socketService';

interface AuthStore {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  pendingOtp: { userId: string; email: string; name: string } | null;

  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<{ userId: string; email: string }>;
  googleAuth: (idToken: string) => Promise<{ userId: string; email: string; name: string }>;
  verifyOTP: (userId: string, otp: string) => Promise<void>;
  googleVerifyOTP: (userId: string, otp: string) => Promise<void>;
  resendOTP: (userId: string) => Promise<void>;
  logout: () => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  refreshUser: () => Promise<void>;
  setPendingOtp: (data: { userId: string; email: string; name: string } | null) => void;
}

const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isLoading: false,
      pendingOtp: null,

      login: async (email, password) => {
        set({ isLoading: true });
        try {
          const res = await api.post('/auth/login', { email, password });
          const { user, accessToken, refreshToken } = res.data.data;
          set({ user, accessToken, refreshToken, isLoading: false });
          socketService.connect(accessToken);
        } catch (err) {
          // Always reset loading — even on network timeout or 5xx
          set({ isLoading: false });
          throw err;
        }
      },

      register: async (email, password, name) => {
        set({ isLoading: true });
        try {
          const res = await api.post('/auth/register', { email, password, name });
          const { userId, email: returnedEmail } = res.data.data;
          set({ isLoading: false });
          return { userId, email: returnedEmail };
        } catch (err) {
          set({ isLoading: false });
          throw err;
        }
      },

      googleAuth: async (idToken) => {
        set({ isLoading: true });
        try {
          const res = await api.post('/auth/google', { idToken });
          const { userId, email, name } = res.data.data;
          set({ isLoading: false });
          return { userId, email, name };
        } catch (err) {
          set({ isLoading: false });
          throw err;
        }
      },

      verifyOTP: async (userId, otp) => {
        set({ isLoading: true });
        try {
          const res = await api.post('/auth/verify-otp', { userId, otp });
          const { user, accessToken, refreshToken } = res.data.data;
          set({ user, accessToken, refreshToken, pendingOtp: null, isLoading: false });
          socketService.connect(accessToken);
        } catch (err) {
          set({ isLoading: false });
          throw err;
        }
      },

      googleVerifyOTP: async (userId, otp) => {
        set({ isLoading: true });
        try {
          const res = await api.post('/auth/google/verify-otp', { userId, otp });
          const { user, accessToken, refreshToken } = res.data.data;
          set({ user, accessToken, refreshToken, pendingOtp: null, isLoading: false });
          socketService.connect(accessToken);
        } catch (err) {
          set({ isLoading: false });
          throw err;
        }
      },

      resendOTP: async (userId) => {
        await api.post('/auth/resend-otp', { userId });
      },

      logout: () => {
        const { accessToken } = get();
        if (accessToken) {
          api.post('/auth/logout').catch(() => {});
        }
        socketService.disconnect();
        set({ user: null, accessToken: null, refreshToken: null, pendingOtp: null, isLoading: false });
      },

      setTokens: (accessToken, refreshToken) => {
        set({ accessToken, refreshToken });
      },

      refreshUser: async () => {
        try {
          const res = await api.get('/auth/me');
          set({ user: res.data.data });
        } catch {
          get().logout();
        }
      },

      setPendingOtp: (data) => set({ pendingOtp: data }),
    }),
    {
      name: 'auction-auth',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        pendingOtp: state.pendingOtp,
      }),
    }
  )
);

setAuthStore(useAuthStore);

export default useAuthStore;