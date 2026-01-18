import { create } from 'zustand';
import { CustomerImportRow } from '../types';

interface MenuInput {
  name: string;
  price: number;
}

interface OnboardingState {
  // Current step (1, 2, or 3)
  currentStep: number;

  // Step 1 data
  shopName: string;
  businessNumber: string;

  // Step 2 data
  menus: MenuInput[];

  // Step 3 data
  importedCustomers: CustomerImportRow[];

  // Actions
  setStep: (step: number) => void;
  setStep1Data: (name: string, businessNumber: string) => void;
  setStep2Data: (menus: MenuInput[]) => void;
  setStep3Data: (customers: CustomerImportRow[]) => void;
  addMenu: () => void;
  updateMenu: (index: number, field: keyof MenuInput, value: string | number) => void;
  removeMenu: (index: number) => void;
  reset: () => void;
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  currentStep: 1,
  shopName: '',
  businessNumber: '',
  menus: [{ name: '', price: 0 }],
  importedCustomers: [],

  setStep: (step) => set({ currentStep: step }),

  setStep1Data: (shopName, businessNumber) =>
    set({ shopName, businessNumber }),

  setStep2Data: (menus) => set({ menus }),

  setStep3Data: (customers) => set({ importedCustomers: customers }),

  addMenu: () =>
    set((state) => ({
      menus: [...state.menus, { name: '', price: 0 }],
    })),

  updateMenu: (index, field, value) =>
    set((state) => {
      const menus = [...state.menus];
      menus[index] = { ...menus[index], [field]: value };
      return { menus };
    }),

  removeMenu: (index) =>
    set((state) => ({
      menus: state.menus.filter((_, i) => i !== index),
    })),

  reset: () =>
    set({
      currentStep: 1,
      shopName: '',
      businessNumber: '',
      menus: [{ name: '', price: 0 }],
      importedCustomers: [],
    }),
}));
