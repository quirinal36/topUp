import apiClient from './client';
import { Subscription, PaymentHistory, SubscriptionConfig } from '../types';

// 구독 상태 조회
export const getSubscription = async (): Promise<Subscription> => {
  const response = await apiClient.get('/subscription');
  return response.data;
};

// 구독 설정 조회
export const getSubscriptionConfig = async (): Promise<SubscriptionConfig> => {
  const response = await apiClient.get('/subscription/config');
  return response.data;
};

// 빌링키 등록
export const registerBillingKey = async (authKey: string): Promise<{
  success: boolean;
  customer_key: string;
}> => {
  const response = await apiClient.post('/subscription/billing-key', {
    auth_key: authKey,
  });
  return response.data;
};

// 정기 구독 시작
export const startSubscription = async (): Promise<{
  success: boolean;
  subscription: Subscription;
  payment?: PaymentHistory;
}> => {
  const response = await apiClient.post('/subscription/subscribe');
  return response.data;
};

// 구독 취소
export const cancelSubscription = async (reason?: string): Promise<{
  success: boolean;
  subscription: Subscription;
}> => {
  const response = await apiClient.post('/subscription/cancel', {
    reason,
  });
  return response.data;
};

// 결제 내역 조회
export const getPaymentHistory = async (limit: number = 10): Promise<PaymentHistory[]> => {
  const response = await apiClient.get('/subscription/payments', {
    params: { limit },
  });
  return response.data;
};

// 전화번호 업데이트
export const updatePhone = async (phone: string): Promise<{ success: boolean }> => {
  const response = await apiClient.put('/subscription/phone', { phone });
  return response.data;
};
