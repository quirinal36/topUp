import apiClient from './client';
import { OnboardingStatus, CustomerImportRow, CustomerImportResponse } from '../types';

export interface BusinessVerifyResponse {
  is_valid: boolean;
  status_code: string;
  status_name: string;
  tax_type: string;
  message: string;
}

export interface BusinessDuplicateResponse {
  is_duplicate: boolean;
  message: string;
}

export const getOnboardingStatus = async (): Promise<OnboardingStatus> => {
  const response = await apiClient.get('/onboarding/status');
  return response.data;
};

export const verifyBusinessNumber = async (
  businessNumber: string
): Promise<BusinessVerifyResponse> => {
  const response = await apiClient.post('/onboarding/verify-business-number', {
    business_number: businessNumber,
  });
  return response.data;
};

export const checkBusinessNumberDuplicate = async (
  businessNumber: string
): Promise<BusinessDuplicateResponse> => {
  const digits = businessNumber.replace(/\D/g, '');
  const response = await apiClient.get(`/onboarding/check-business-number/${digits}`);
  return response.data;
};

export const updateStep1 = async (data: {
  name: string;
  business_number: string;
  is_business_verified?: boolean;
}): Promise<{ message: string }> => {
  const response = await apiClient.put('/onboarding/step1', data);
  return response.data;
};

export const updateStep2 = async (menus: {
  name: string;
  price: number;
}[]): Promise<{ message: string; count: number }> => {
  const response = await apiClient.put('/onboarding/step2', { menus });
  return response.data;
};

export const importCustomers = async (
  customers: CustomerImportRow[]
): Promise<CustomerImportResponse> => {
  const response = await apiClient.post('/onboarding/step3/import', { customers });
  return response.data;
};

export const completeOnboarding = async (): Promise<{ message: string }> => {
  const response = await apiClient.post('/onboarding/complete');
  return response.data;
};

export const downloadTemplate = async (): Promise<Blob> => {
  const response = await apiClient.get('/onboarding/template', {
    responseType: 'blob',
  });
  return response.data;
};
