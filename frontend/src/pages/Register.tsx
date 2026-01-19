import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, Store } from 'lucide-react';
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';
import { useAuthStore } from '../stores/authStore';
import { register as apiRegister } from '../api/auth';

// Cloudflare Turnstile Site Key (환경변수에서 로드)
const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || '';

export default function Register() {
  const navigate = useNavigate();
  const { isAuthenticated, login } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [shopName, setShopName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileInstance>(null);

  // 이미 로그인되어 있으면 대시보드로 이동
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  const validatePassword = (password: string): string | null => {
    if (password.length < 8) {
      return '비밀번호는 8자 이상이어야 합니다';
    }
    if (!/[a-zA-Z]/.test(password)) {
      return '비밀번호는 영문을 포함해야 합니다';
    }
    if (!/[0-9]/.test(password)) {
      return '비밀번호는 숫자를 포함해야 합니다';
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // 비밀번호 유효성 검사
    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    // 비밀번호 확인
    if (password !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다');
      return;
    }

    // Turnstile 검증 (Site Key가 설정된 경우에만)
    if (TURNSTILE_SITE_KEY && !turnstileToken) {
      setError('보안 검증을 완료해주세요');
      return;
    }

    setIsLoading(true);

    try {
      const response = await apiRegister(email, password, shopName, turnstileToken || undefined);
      await login(response.access_token);
      navigate('/');
    } catch (err: unknown) {
      const error = err as { response?: { status?: number; data?: { detail?: string } } };
      if (error.response?.status === 400) {
        setError(error.response.data?.detail || '회원가입에 실패했습니다');
      } else if (error.response?.data?.detail) {
        setError(error.response.data.detail);
      } else {
        setError('회원가입 중 오류가 발생했습니다');
      }
      // Turnstile 리셋 (실패 시 재시도 가능하도록)
      turnstileRef.current?.reset();
      setTurnstileToken(null);
    } finally {
      setIsLoading(false);
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

        {/* 회원가입 카드 */}
        <div className="bg-white dark:bg-[#2d2420] rounded-modal shadow-modal p-6">
          <h2 className="text-heading-3 text-center text-gray-900 dark:text-white mb-6">
            회원가입
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
                  placeholder="8자 이상, 영문+숫자"
                  required
                  minLength={8}
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
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                8자 이상, 영문과 숫자를 포함해주세요
              </p>
            </div>

            {/* 비밀번호 확인 */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                비밀번호 확인
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="비밀번호 재입력"
                  required
                  className="w-full pl-10 pr-12 py-3 rounded-button border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#1a1412] text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* 상점명 입력 */}
            <div>
              <label htmlFor="shopName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                상점명
              </label>
              <div className="relative">
                <Store className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="shopName"
                  type="text"
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  placeholder="내 카페"
                  required
                  maxLength={100}
                  className="w-full pl-10 pr-4 py-3 rounded-button border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#1a1412] text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Turnstile 봇 방지 */}
            {TURNSTILE_SITE_KEY && (
              <div className="flex justify-center">
                <Turnstile
                  ref={turnstileRef}
                  siteKey={TURNSTILE_SITE_KEY}
                  onSuccess={(token) => setTurnstileToken(token)}
                  onError={() => {
                    setTurnstileToken(null);
                    setError('보안 검증에 실패했습니다. 페이지를 새로고침해주세요.');
                  }}
                  onExpire={() => setTurnstileToken(null)}
                  options={{
                    theme: 'auto',
                    size: 'normal',
                  }}
                />
              </div>
            )}

            {/* 에러 메시지 */}
            {error && (
              <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
            )}

            {/* 회원가입 버튼 */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full min-h-touch flex items-center justify-center gap-2 px-4 py-3 rounded-button font-medium transition-colors bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? '가입 중...' : '회원가입'}
            </button>
          </form>

          {/* 로그인 링크 */}
          <div className="mt-6 text-center">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              이미 계정이 있으신가요?{' '}
            </span>
            <Link
              to="/login"
              className="text-sm font-medium text-primary-600 dark:text-primary-400 hover:underline"
            >
              로그인
            </Link>
          </div>
        </div>

        {/* 하단 안내 */}
        <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-6">
          회원가입 시 서비스 이용약관에 동의하게 됩니다
        </p>
      </div>
    </div>
  );
}
