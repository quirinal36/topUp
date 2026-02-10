import apiClient from './client';
import { Customer, CustomerDetail, CustomerListResponse } from '../types';

// 고객 목록 조회
export const getCustomers = async (params: {
  query?: string;
  sort_by?: string;
  sort_order?: string;
  page?: number;
  page_size?: number;
}): Promise<CustomerListResponse> => {
  const response = await apiClient.get('/customers', { params });
  return response.data;
};

// 고객 상세 조회
export const getCustomer = async (customerId: string): Promise<CustomerDetail> => {
  const response = await apiClient.get(`/customers/${customerId}`);
  return response.data;
};

// 고객 등록
export const createCustomer = async (data: {
  name: string;
  phone: string;
}): Promise<Customer> => {
  const response = await apiClient.post('/customers', data);
  return response.data;
};

// 고객 수정
export const updateCustomer = async (
  customerId: string,
  data: { name?: string; phone?: string }
): Promise<Customer> => {
  const response = await apiClient.put(`/customers/${customerId}`, data);
  return response.data;
};

// 고객 삭제
export const deleteCustomer = async (customerId: string): Promise<void> => {
  await apiClient.delete(`/customers/${customerId}`);
};

// 고객 데이터 내보내기 (Excel)
export const exportCustomers = async (): Promise<Blob> => {
  const response = await apiClient.get('/customers/data/export', {
    responseType: 'blob',
  });
  return response.data;
};

// 고객 데이터 가져오기 템플릿 다운로드
export const downloadCustomerTemplate = async (): Promise<Blob> => {
  const response = await apiClient.get('/customers/data/template', {
    responseType: 'blob',
  });
  return response.data;
};

// 고객 데이터 일괄 가져오기
export const importCustomers = async (
  customers: { name: string; phone: string; balance: number }[]
): Promise<{ total: number; imported: number; skipped: number; errors: string[] }> => {
  const response = await apiClient.post('/customers/data/import', { customers });
  return response.data;
};
