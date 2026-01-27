import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import * as Sentry from '@sentry/react';
import { getCurrentShop } from '../api/auth';

// 30분 (밀리초)
const PIN_TIMEOUT_MS = 30 * 60 * 1000;

interface AuthState {
  isAuthenticated: boolean;
  shopId: string | null;
  shopName: string | null;
  token: string | null;
  pinVerified: boolean;
  darkMode: boolean;
  lastActivityTime: number | null;
  onboardingCompleted: boolean | null;

  // Actions
  login: (token: string) => Promise<void>;
  logout: () => void;
  verifyPin: () => void;
  resetPinVerification: () => void;
  toggleDarkMode: () => void;
  setShopName: (name: string) => void;
  updateActivity: () => void;
  checkPinTimeout: () => boolean;
  setOnboardingCompleted: (completed: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      isAuthenticated: false,
      shopId: null,
      shopName: null,
      token: null,
      pinVerified: false,
      darkMode: false,
      lastActivityTime: null,
      onboardingCompleted: null,

      login: async (token: string) => {
        localStorage.setItem('access_token', token);
        try {
          const shop = await getCurrentShop();
          // Sentry 사용자 컨텍스트 설정
          Sentry.setUser({ id: shop.id, username: shop.name });
          set({
            isAuthenticated: true,
            shopId: shop.id,
            shopName: shop.name,
            token,
            pinVerified: false,
            onboardingCompleted: shop.onboarding_completed ?? false,
          });
        } catch (error) {
          console.error('Failed to get shop info:', error);
          set({ isAuthenticated: true, token, pinVerified: false });
        }
      },

      logout: () => {
        localStorage.removeItem('access_token');
        // Sentry 사용자 컨텍스트 초기화
        Sentry.setUser(null);
        set({
          isAuthenticated: false,
          shopId: null,
          shopName: null,
          token: null,
          pinVerified: false,
        });
      },

      verifyPin: () => {
        set({ pinVerified: true, lastActivityTime: Date.now() });
      },

      resetPinVerification: () => {
        set({ pinVerified: false, lastActivityTime: null });
      },

      toggleDarkMode: () => {
        const newMode = !get().darkMode;
        set({ darkMode: newMode });
        if (newMode) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      },

      setShopName: (name: string) => {
        set({ shopName: name });
      },

      updateActivity: () => {
        const { pinVerified } = get();
        if (pinVerified) {
          set({ lastActivityTime: Date.now() });
        }
      },

      checkPinTimeout: () => {
        const { pinVerified, lastActivityTime } = get();
        if (!pinVerified) return false;

        if (lastActivityTime) {
          const elapsed = Date.now() - lastActivityTime;
          if (elapsed > PIN_TIMEOUT_MS) {
            set({ pinVerified: false, lastActivityTime: null });
            return true; // PIN이 타임아웃되었음
          }
        }
        return false;
      },

      setOnboardingCompleted: (completed: boolean) => {
        set({ onboardingCompleted: completed });
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        shopId: state.shopId,
        shopName: state.shopName,
        token: state.token,
        darkMode: state.darkMode,
        lastActivityTime: state.lastActivityTime,
        onboardingCompleted: state.onboardingCompleted,
      }),
    }
  )
);
