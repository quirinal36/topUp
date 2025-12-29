import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getCurrentShop } from '../api/auth';

interface AuthState {
  isAuthenticated: boolean;
  shopId: string | null;
  shopName: string | null;
  token: string | null;
  pinVerified: boolean;
  darkMode: boolean;

  // Actions
  login: (token: string) => Promise<void>;
  logout: () => void;
  verifyPin: () => void;
  resetPinVerification: () => void;
  toggleDarkMode: () => void;
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

      login: async (token: string) => {
        localStorage.setItem('access_token', token);
        try {
          const shop = await getCurrentShop();
          set({
            isAuthenticated: true,
            shopId: shop.id,
            shopName: shop.name,
            token,
            pinVerified: false,
          });
        } catch (error) {
          console.error('Failed to get shop info:', error);
          set({ isAuthenticated: true, token, pinVerified: false });
        }
      },

      logout: () => {
        localStorage.removeItem('access_token');
        set({
          isAuthenticated: false,
          shopId: null,
          shopName: null,
          token: null,
          pinVerified: false,
        });
      },

      verifyPin: () => {
        set({ pinVerified: true });
      },

      resetPinVerification: () => {
        set({ pinVerified: false });
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
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        shopId: state.shopId,
        shopName: state.shopName,
        token: state.token,
        darkMode: state.darkMode,
      }),
    }
  )
);
