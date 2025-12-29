import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

/**
 * 인증 관련 커스텀 훅
 * 로그인, 로그아웃 및 인증 상태 관리
 */
export function useAuth() {
  const navigate = useNavigate();
  const {
    isAuthenticated,
    shopId,
    shopName,
    token,
    pinVerified,
    darkMode,
    login: storeLogin,
    logout: storeLogout,
    verifyPin: storeVerifyPin,
    resetPinVerification,
    toggleDarkMode,
  } = useAuthStore();

  // 로그인 후 리다이렉트 처리
  const login = useCallback(
    async (accessToken: string) => {
      await storeLogin(accessToken);
      navigate('/');
    },
    [storeLogin, navigate]
  );

  // 로그아웃 후 로그인 페이지로 리다이렉트
  const logout = useCallback(() => {
    storeLogout();
    navigate('/login');
  }, [storeLogout, navigate]);

  // PIN 인증
  const verifyPin = useCallback(() => {
    storeVerifyPin();
  }, [storeVerifyPin]);

  // 인증 상태 확인
  const checkAuth = useCallback(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return false;
    }
    return true;
  }, [isAuthenticated, navigate]);

  return {
    // 상태
    isAuthenticated,
    shopId,
    shopName,
    token,
    pinVerified,
    darkMode,

    // 액션
    login,
    logout,
    verifyPin,
    resetPinVerification,
    toggleDarkMode,
    checkAuth,
  };
}

export default useAuth;
