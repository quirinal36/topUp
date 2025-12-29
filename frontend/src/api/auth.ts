import apiClient from './client';
import { LoginResponse } from '../types';

// 소셜 로그인 URL 가져오기
export const getLoginUrl = async (provider: 'naver' | 'kakao'): Promise<string> => {
  const response = await apiClient.get(`/auth/login/${provider}/url`);
  return response.data.url;
};

// 소셜 로그인 처리
export const socialLogin = async (provider: string, code: string): Promise<LoginResponse> => {
  const response = await apiClient.post(`/auth/login/${provider}`, { code });
  return response.data;
};

// PIN 검증
export const verifyPin = async (pin: string): Promise<{
  verified: boolean;
  remaining_attempts?: number;
  locked_until?: string;
}> => {
  const response = await apiClient.post('/auth/pin/verify', { pin });
  return response.data;
};

// PIN 변경
export const changePin = async (currentPin: string, newPin: string): Promise<void> => {
  await apiClient.post('/auth/pin/change', {
    current_pin: currentPin,
    new_pin: newPin,
  });
};

// 현재 상점 정보 가져오기
export const getCurrentShop = async (): Promise<{
  id: string;
  name: string;
  created_at: string;
}> => {
  const response = await apiClient.get('/auth/me');
  return response.data;
};

// 연동된 소셜 계정 목록
export const getSocialAccounts = async () => {
  const response = await apiClient.get('/auth/social-accounts');
  return response.data;
};
