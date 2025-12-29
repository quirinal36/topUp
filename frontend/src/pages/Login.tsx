import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import Button from '../components/common/Button';
import { useAuthStore } from '../stores/authStore';
import { getLoginUrl, socialLogin } from '../api/auth';

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, login } = useAuthStore();

  // 이미 로그인되어 있으면 대시보드로 이동
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  // OAuth 콜백 처리
  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    if (code) {
      const provider = state === 'naver' ? 'naver' : 'kakao';
      handleOAuthCallback(provider, code);
    }
  }, [searchParams]);

  const handleOAuthCallback = async (provider: string, code: string) => {
    try {
      const response = await socialLogin(provider, code);
      await login(response.access_token);
      navigate('/');
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  const handleNaverLogin = async () => {
    try {
      const url = await getLoginUrl('naver');
      window.location.href = url;
    } catch (error) {
      console.error('Failed to get Naver login URL:', error);
    }
  };

  const handleKakaoLogin = async () => {
    try {
      const url = await getLoginUrl('kakao');
      window.location.href = url;
    } catch (error) {
      console.error('Failed to get Kakao login URL:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-50 to-secondary-100 dark:from-[#1a1412] dark:to-[#2d2420] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* 로고 */}
        <div className="text-center mb-8">
          <span className="text-6xl">☕</span>
          <h1 className="text-heading-1 text-primary-700 dark:text-primary-400 mt-4">
            카페 선결제
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            편리한 선결제 관리 시스템
          </p>
        </div>

        {/* 로그인 카드 */}
        <div className="bg-white dark:bg-[#2d2420] rounded-modal shadow-modal p-6">
          <h2 className="text-heading-3 text-center text-gray-900 dark:text-white mb-6">
            로그인
          </h2>

          <div className="space-y-3">
            {/* 네이버 로그인 */}
            <button
              onClick={handleNaverLogin}
              className="w-full min-h-touch flex items-center justify-center gap-2 px-4 py-3 rounded-button font-medium transition-colors bg-[#03C75A] text-white hover:bg-[#02b351]"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M16.273 12.845L7.376 0H0v24h7.727V11.155L16.624 24H24V0h-7.727v12.845z"/>
              </svg>
              네이버로 시작하기
            </button>

            {/* 카카오 로그인 */}
            <button
              onClick={handleKakaoLogin}
              className="w-full min-h-touch flex items-center justify-center gap-2 px-4 py-3 rounded-button font-medium transition-colors bg-[#FEE500] text-[#000000D9] hover:bg-[#FADA0A]"
            >
              <MessageCircle className="w-5 h-5" />
              카카오로 시작하기
            </button>
          </div>

          <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6">
            처음 로그인하시면 자동으로 상점이 등록됩니다
          </p>
        </div>

        {/* 하단 안내 */}
        <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-6">
          로그인 시 서비스 이용약관에 동의하게 됩니다
        </p>
      </div>
    </div>
  );
}
