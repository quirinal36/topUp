import apiClient from './client';
import { LoginResponse } from '../types';

// 이메일/비밀번호 로그인
export const login = async (email: string, password: string): Promise<LoginResponse> => {
  const response = await apiClient.post('/auth/login', { email, password });
  return response.data;
};

// 회원가입
export const register = async (
  email: string,
  password: string,
  shopName: string
): Promise<LoginResponse> => {
  const response = await apiClient.post('/auth/register', {
    email,
    password,
    shop_name: shopName,
  });
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
  email?: string;
  created_at: string;
}> => {
  const response = await apiClient.get('/auth/me');
  return response.data;
};

// 상점 정보 수정
export const updateShop = async (name: string): Promise<{
  id: string;
  name: string;
  email?: string;
  created_at: string;
}> => {
  const response = await apiClient.put('/auth/me', { name });
  return response.data;
};
