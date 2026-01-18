import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { login as apiLogin } from '../api/auth';

export default function Login() {
  const navigate = useNavigate();
  const { isAuthenticated, login } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // 이미 로그인되어 있으면 대시보드로 이동
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await apiLogin(email, password);
      await login(response.access_token);
      navigate('/');
    } catch (err: unknown) {
      const error = err as { response?: { status?: number; data?: { detail?: string } } };
      if (error.response?.status === 401) {
        setError('이메일 또는 비밀번호가 올바르지 않습니다');
      } else if (error.response?.data?.detail) {
        setError(error.response.data.detail);
      } else {
        setError('로그인 중 오류가 발생했습니다');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-50 to-secondary-100 dark:from-[#1a1412] dark:to-[#2d2420] overflow-auto">
      <div className="min-h-screen flex items-center justify-center p-4 pb-[280px]">
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

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 이메일 입력 */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                이메일
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="cafe@example.com"
                  required
                  className="w-full pl-10 pr-4 py-3 rounded-button border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#1a1412] text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* 비밀번호 입력 */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                비밀번호
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="********"
                  required
                  className="w-full pl-10 pr-12 py-3 rounded-button border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#1a1412] text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* 에러 메시지 */}
            {error && (
              <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
            )}

            {/* 비밀번호 찾기 링크 */}
            <div className="text-right">
              <Link
                to="/forgot-password"
                className="text-sm text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400"
              >
                비밀번호를 잊으셨나요?
              </Link>
            </div>

            {/* 로그인 버튼 */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full min-h-touch flex items-center justify-center gap-2 px-4 py-3 rounded-button font-medium transition-colors bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? '로그인 중...' : '로그인'}
            </button>
          </form>

          {/* 회원가입 링크 */}
          <div className="mt-6 text-center">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              계정이 없으신가요?{' '}
            </span>
            <Link
              to="/register"
              className="text-sm font-medium text-primary-600 dark:text-primary-400 hover:underline"
            >
              회원가입
            </Link>
          </div>
        </div>

        {/* 하단 안내 */}
        <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-6">
          로그인 시 서비스 이용약관에 동의하게 됩니다
        </p>
      </div>
      </div>
    </div>
  );
}
