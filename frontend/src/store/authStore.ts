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
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  refreshUser: () => Promise<void>;
}

const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isLoading: false,

      login: async (email, password) => {
        set({ isLoading: true });
        try {
          const res = await api.post('/auth/login', { email, password });
          const { user, accessToken, refreshToken } = res.data.data;
          set({ user, accessToken, refreshToken, isLoading: false });
          socketService.connect(accessToken);
        } catch (err) {
          set({ isLoading: false });
          throw err;
        }
      },

      register: async (email, password, name) => {
        set({ isLoading: true });
        try {
          const res = await api.post('/auth/register', { email, password, name });
          const { user, accessToken, refreshToken } = res.data.data;
          set({ user, accessToken, refreshToken, isLoading: false });
          socketService.connect(accessToken);
        } catch (err) {
          set({ isLoading: false });
          throw err;
        }
      },

      logout: () => {
        const { accessToken } = get();
        if (accessToken) {
          api.post('/auth/logout').catch(() => {});
        }
        socketService.disconnect();
        set({ user: null, accessToken: null, refreshToken: null });
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
    }),
    {
      name: 'auction-auth',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
    }
  )
);

// Wire up the auth store to the API interceptor
setAuthStore(useAuthStore);

export default useAuthStore;
