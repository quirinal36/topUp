import apiClient from './client';
import { LoginResponse } from '../types';

// 아이디/비밀번호 로그인
export const login = async (username: string, password: string): Promise<LoginResponse> => {
  const response = await apiClient.post('/auth/login', { username, password });
  return response.data;
};

// 아이디 중복 확인
export const checkUsername = async (username: string): Promise<{
  available: boolean;
  message: string;
}> => {
  const response = await apiClient.post('/auth/check-username', { username });
  return response.data;
};

// NICE 본인인증 시작
export const startNiceAuth = async (): Promise<{
  request_id: string;
  enc_data: string;
  mock_mode: boolean;
}> => {
  const response = await apiClient.post('/auth/nice/start');
  return response.data;
};

// NICE 본인인증 완료
export const completeNiceAuth = async (requestId: string, encData: string): Promise<{
  verification_token: string;
  expires_at: string;
}> => {
  const response = await apiClient.post('/auth/nice/complete', {
    request_id: requestId,
    enc_data: encData,
  });
  return response.data;
};

// 회원가입 (본인인증 필수)
export const register = async (
  username: string,
  password: string,
  shopName: string,
  verificationToken: string,
  email?: string,
  turnstileToken?: string
): Promise<LoginResponse> => {
  const response = await apiClient.post('/auth/register', {
    username,
    password,
    shop_name: shopName,
    verification_token: verificationToken,
    email: email || null,
    turnstile_token: turnstileToken,
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
  username?: string;
  email?: string;
  business_number?: string;
  onboarding_completed: boolean;
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
  business_number?: string;
  onboarding_completed: boolean;
  created_at: string;
}> => {
  const response = await apiClient.put('/auth/me', { name });
  return response.data;
};

// ========== 비밀번호 재설정 ==========

// 비밀번호 재설정 인증번호 발송 요청
export const requestPasswordReset = async (email: string): Promise<{
  message: string;
  expires_in?: number;
}> => {
  const response = await apiClient.post('/auth/password-reset/request', { email });
  return response.data;
};

// 인증번호 검증
export const verifyResetCode = async (email: string, code: string): Promise<{
  verified: boolean;
  reset_token?: string;
  remaining_attempts?: number;
  locked_until?: string;
}> => {
  const response = await apiClient.post('/auth/password-reset/verify', { email, code });
  return response.data;
};

// 새 비밀번호 설정
export const confirmPasswordReset = async (
  email: string,
  resetToken: string,
  newPassword: string
): Promise<{
  message: string;
}> => {
  const response = await apiClient.post('/auth/password-reset/confirm', {
    email,
    reset_token: resetToken,
    new_password: newPassword,
  });
  return response.data;
};
