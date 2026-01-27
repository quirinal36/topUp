/**
 * 중앙 에러 핸들링 유틸리티
 * 네트워크 오류, 서버 오류 등을 일관되게 처리
 */
import { AxiosError } from 'axios';

export interface ErrorInfo {
  type: 'network' | 'server' | 'auth' | 'validation' | 'unknown';
  message: string;
  status?: number;
  detail?: string;
}

/**
 * 네트워크 오류인지 확인
 */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof AxiosError) {
    // 네트워크 오류 (ERR_NETWORK, ERR_INTERNET_DISCONNECTED 등)
    if (error.code === 'ERR_NETWORK' || error.code === 'ECONNABORTED') {
      return true;
    }
    // response가 없으면 네트워크 문제
    if (!error.response && error.request) {
      return true;
    }
  }
  return false;
}

/**
 * 서버 오류인지 확인 (5xx)
 */
export function isServerError(error: unknown): boolean {
  if (error instanceof AxiosError && error.response) {
    const status = error.response.status;
    return status >= 500 && status < 600;
  }
  return false;
}

/**
 * 인증 오류인지 확인 (401, 403)
 */
export function isAuthError(error: unknown): boolean {
  if (error instanceof AxiosError && error.response) {
    const status = error.response.status;
    return status === 401 || status === 403;
  }
  return false;
}

/**
 * 유효성 검증 오류인지 확인 (400, 422)
 */
export function isValidationError(error: unknown): boolean {
  if (error instanceof AxiosError && error.response) {
    const status = error.response.status;
    return status === 400 || status === 422;
  }
  return false;
}

/**
 * 에러를 분석하여 사용자에게 보여줄 정보 반환
 */
export function parseError(error: unknown): ErrorInfo {
  // 네트워크 오류
  if (isNetworkError(error)) {
    return {
      type: 'network',
      message: '네트워크 오류가 발생했습니다.',
      detail: '인터넷 연결을 확인해 주세요.',
    };
  }

  // 서버 오류 (5xx)
  if (isServerError(error)) {
    const axiosError = error as AxiosError;
    return {
      type: 'server',
      message: '서버 오류가 발생했습니다.',
      detail: '잠시 후 다시 시도해 주세요. 문제가 계속되면 관리자에게 문의해 주세요.',
      status: axiosError.response?.status,
    };
  }

  // 인증 오류
  if (isAuthError(error)) {
    const axiosError = error as AxiosError;
    return {
      type: 'auth',
      message: axiosError.response?.status === 401
        ? '로그인이 필요합니다.'
        : '접근 권한이 없습니다.',
      status: axiosError.response?.status,
    };
  }

  // 유효성 검증 오류
  if (isValidationError(error)) {
    const axiosError = error as AxiosError<{ detail?: string }>;
    return {
      type: 'validation',
      message: axiosError.response?.data?.detail || '입력 값을 확인해 주세요.',
      status: axiosError.response?.status,
    };
  }

  // Axios 에러지만 위 케이스에 해당하지 않는 경우
  if (error instanceof AxiosError) {
    const detail = error.response?.data?.detail;
    return {
      type: 'unknown',
      message: typeof detail === 'string' ? detail : '오류가 발생했습니다.',
      status: error.response?.status,
    };
  }

  // 일반 에러
  if (error instanceof Error) {
    return {
      type: 'unknown',
      message: error.message || '오류가 발생했습니다.',
    };
  }

  return {
    type: 'unknown',
    message: '알 수 없는 오류가 발생했습니다.',
  };
}

/**
 * 에러 타입에 따른 토스트 표시용 메시지 반환
 */
export function getErrorMessage(error: unknown): string {
  const errorInfo = parseError(error);

  if (errorInfo.type === 'server') {
    return '서버 오류가 발생했습니다. 관리자에게 문의해 주세요.';
  }

  if (errorInfo.type === 'network') {
    return '네트워크 오류가 발생했습니다. 인터넷 연결을 확인해 주세요.';
  }

  return errorInfo.message;
}
