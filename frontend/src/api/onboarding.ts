import apiClient from './client';
import { OnboardingStatus, CustomerImportRow, CustomerImportResponse } from '../types';

export const getOnboardingStatus = async (): Promise<OnboardingStatus> => {
  const response = await apiClient.get('/onboarding/status');
  return response.data;
};

export const updateStep1 = async (data: {
  name: string;
  business_number?: string;
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
