import { create } from 'zustand';
import { Customer, CustomerDetail } from '../types';
import * as customerApi from '../api/customers';

interface CustomerState {
  customers: Customer[];
  selectedCustomer: CustomerDetail | null;
  total: number;
  page: number;
  pageSize: number;
  searchQuery: string;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchCustomers: (query?: string, page?: number) => Promise<void>;
  fetchCustomer: (id: string) => Promise<void>;
  createCustomer: (name: string, phoneSuffix: string) => Promise<Customer>;
  updateCustomer: (id: string, data: { name?: string; phone_suffix?: string }) => Promise<void>;
  deleteCustomer: (id: string) => Promise<void>;
  setSearchQuery: (query: string) => void;
  clearSelectedCustomer: () => void;
}

export const useCustomerStore = create<CustomerState>((set, get) => ({
  customers: [],
  selectedCustomer: null,
  total: 0,
  page: 1,
  pageSize: 20,
  searchQuery: '',
  isLoading: false,
  error: null,

  fetchCustomers: async (query?: string, page?: number) => {
    set({ isLoading: true, error: null });
    try {
      const response = await customerApi.getCustomers({
        query: query ?? get().searchQuery,
        page: page ?? get().page,
        page_size: get().pageSize,
      });
      set({
        customers: response.customers,
        total: response.total,
        page: response.page,
        isLoading: false,
      });
    } catch (error) {
      set({ error: '고객 목록을 불러오는데 실패했습니다.', isLoading: false });
    }
  },

  fetchCustomer: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const customer = await customerApi.getCustomer(id);
      set({ selectedCustomer: customer, isLoading: false });
    } catch (error) {
      set({ error: '고객 정보를 불러오는데 실패했습니다.', isLoading: false });
    }
  },

  createCustomer: async (name: string, phoneSuffix: string) => {
    const customer = await customerApi.createCustomer({
      name,
      phone_suffix: phoneSuffix,
    });
    await get().fetchCustomers();
    return customer;
  },

  updateCustomer: async (id: string, data: { name?: string; phone_suffix?: string }) => {
    await customerApi.updateCustomer(id, data);
    await get().fetchCustomers();
    if (get().selectedCustomer?.id === id) {
      await get().fetchCustomer(id);
    }
  },

  deleteCustomer: async (id: string) => {
    await customerApi.deleteCustomer(id);
    await get().fetchCustomers();
    if (get().selectedCustomer?.id === id) {
      set({ selectedCustomer: null });
    }
  },

  setSearchQuery: (query: string) => {
    set({ searchQuery: query, page: 1 });
  },

  clearSelectedCustomer: () => {
    set({ selectedCustomer: null });
  },
}));
