import apiClient from './client';
import { Transaction, TransactionListResponse, PaymentMethod } from '../types';

// 거래 내역 조회
export const getTransactions = async (params: {
  customer_id?: string;
  type?: string;
  page?: number;
  page_size?: number;
}): Promise<TransactionListResponse> => {
  const response = await apiClient.get('/transactions', { params });
  return response.data;
};

// 충전
export const charge = async (data: {
  customer_id: string;
  actual_payment: number;
  service_amount?: number;
  payment_method: PaymentMethod;
  note?: string;
}): Promise<Transaction> => {
  const response = await apiClient.post('/transactions/charge', data);
  return response.data;
};

// 차감
export const deduct = async (data: {
  customer_id: string;
  amount: number;
  note?: string;
}): Promise<Transaction> => {
  const response = await apiClient.post('/transactions/deduct', data);
  return response.data;
};

// 취소
export const cancelTransaction = async (data: {
  transaction_id: string;
  reason?: string;
}): Promise<Transaction> => {
  const response = await apiClient.post('/transactions/cancel', data);
  return response.data;
};
