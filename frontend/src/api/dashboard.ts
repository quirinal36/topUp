import apiClient from './client';
import { DashboardSummary, AnalyticsPeriod, TopCustomer, PaymentMethodStats } from '../types';

// 대시보드 요약
export const getDashboardSummary = async (): Promise<DashboardSummary> => {
  const response = await apiClient.get('/dashboard/summary');
  return response.data;
};

// 기간별 통계
export const getPeriodAnalytics = async (params: {
  period_type?: 'daily' | 'weekly' | 'monthly';
  start_date?: string;
  end_date?: string;
}): Promise<AnalyticsPeriod[]> => {
  const response = await apiClient.get('/dashboard/analytics/period', { params });
  return response.data;
};

// 상위 충전 고객
export const getTopCustomers = async (limit?: number): Promise<TopCustomer[]> => {
  const response = await apiClient.get('/dashboard/analytics/top-customers', {
    params: { limit },
  });
  return response.data;
};

// 결제 수단별 통계
export const getPaymentMethodStats = async (params?: {
  start_date?: string;
  end_date?: string;
}): Promise<PaymentMethodStats[]> => {
  const response = await apiClient.get('/dashboard/analytics/payment-methods', { params });
  return response.data;
};

// 인기 메뉴
export const getPopularMenus = async (limit?: number): Promise<{ menu: string; count: number }[]> => {
  const response = await apiClient.get('/dashboard/analytics/popular-menus', {
    params: { limit },
  });
  return response.data;
};
