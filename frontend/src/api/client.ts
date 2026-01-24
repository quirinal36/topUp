import axios, { AxiosError } from 'axios';
import { isNetworkError, isServerError } from '../utils/errorHandler';

// API 베이스 URL (환경 변수 또는 기본값)
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// API 클라이언트 생성
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 전역 에러 이벤트 발송 함수
const dispatchNetworkError = () => {
  window.dispatchEvent(new CustomEvent('network-error'));
};

const dispatchServerError = (status: number) => {
  window.dispatchEvent(new CustomEvent('server-error', { detail: { status } }));
};

// 요청 인터셉터 - 토큰 추가
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 응답 인터셉터 - 에러 처리
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    // 네트워크 오류 처리
    if (isNetworkError(error)) {
      dispatchNetworkError();
      return Promise.reject(error);
    }

    // 서버 오류 처리 (5xx)
    if (isServerError(error)) {
      const status = error.response?.status || 500;
      dispatchServerError(status);
      return Promise.reject(error);
    }

    // 인증 오류 처리 (401)
    if (error.response?.status === 401) {
      // 로그인 요청은 401이 정상 응답일 수 있으므로 제외
      const isLoginRequest = error.config?.url?.includes('/auth/login');
      if (!isLoginRequest) {
        // 인증 실패 시 로그아웃
        localStorage.removeItem('access_token');
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
