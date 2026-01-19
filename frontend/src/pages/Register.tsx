import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { User, Lock, Eye, EyeOff, Store, Mail, Check, AlertCircle, Shield, ChevronLeft, ChevronRight } from 'lucide-react';
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';
import { useAuthStore } from '../stores/authStore';
import { register as apiRegister, checkUsername, startNiceAuth, completeNiceAuth } from '../api/auth';

// Cloudflare Turnstile Site Key (환경변수에서 로드)
const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || '';

type Step = 1 | 2 | 3 | 4;

export default function Register() {
  const navigate = useNavigate();
  const { isAuthenticated, login } = useAuthStore();

  // Step 상태
  const [currentStep, setCurrentStep] = useState<Step>(1);

  // Step 1: 아이디/비밀번호
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [usernameChecked, setUsernameChecked] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState(false);
  const [checkingUsername, setCheckingUsername] = useState(false);

  // Step 2: 상점 정보
  const [shopName, setShopName] = useState('');
  const [email, setEmail] = useState('');

  // Step 3: 본인인증
  const [verificationToken, setVerificationToken] = useState<string | null>(null);
  const [verificationExpires, setVerificationExpires] = useState<Date | null>(null);
  const [niceAuthLoading, setNiceAuthLoading] = useState(false);

  // Step 4: 최종 가입
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileInstance>(null);

  // 공통
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // 이미 로그인되어 있으면 대시보드로 이동
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  // 아이디 유효성 검사
  const validateUsername = (value: string): string | null => {
    if (value.length < 4) {
      return '아이디는 4자 이상이어야 합니다';
    }
    if (value.length > 20) {
      return '아이디는 20자 이하여야 합니다';
    }
    if (!/^[a-z0-9]+$/.test(value)) {
      return '아이디는 영문 소문자와 숫자만 사용할 수 있습니다';
    }
    return null;
  };

  // 비밀번호 유효성 검사
  const validatePassword = (value: string): string | null => {
    if (value.length < 8) {
      return '비밀번호는 8자 이상이어야 합니다';
    }
    if (!/[a-zA-Z]/.test(value)) {
      return '비밀번호는 영문을 포함해야 합니다';
    }
    if (!/[0-9]/.test(value)) {
      return '비밀번호는 숫자를 포함해야 합니다';
    }
    return null;
  };

  // 아이디 중복 확인
  const handleCheckUsername = async () => {
    const usernameError = validateUsername(username);
    if (usernameError) {
      setError(usernameError);
      return;
    }

    setCheckingUsername(true);
    setError('');

    try {
      const result = await checkUsername(username);
      setUsernameChecked(true);
      setUsernameAvailable(result.available);
      if (!result.available) {
        setError(result.message);
      }
    } catch {
      setError('아이디 확인 중 오류가 발생했습니다');
    } finally {
      setCheckingUsername(false);
    }
  };

  // Step 1 유효성 검사
  const validateStep1 = (): boolean => {
    setError('');

    const usernameError = validateUsername(username);
    if (usernameError) {
      setError(usernameError);
      return false;
    }

    if (!usernameChecked || !usernameAvailable) {
      setError('아이디 중복 확인이 필요합니다');
      return false;
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return false;
    }

    if (password !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다');
      return false;
    }

    return true;
  };

  // Step 2 유효성 검사
  const validateStep2 = (): boolean => {
    setError('');

    if (!shopName.trim()) {
      setError('상점명을 입력해주세요');
      return false;
    }

    if (email && !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) {
      setError('올바른 이메일 형식이 아닙니다');
      return false;
    }

    return true;
  };

  // 본인인증 시작
  const handleStartNiceAuth = async () => {
    setNiceAuthLoading(true);
    setError('');

    try {
      const startResult = await startNiceAuth();

      // 모킹 모드에서는 바로 완료 처리
      if (startResult.mock_mode) {
        const completeResult = await completeNiceAuth(startResult.request_id, startResult.enc_data);
        setVerificationToken(completeResult.verification_token);
        setVerificationExpires(new Date(completeResult.expires_at));
      } else {
        // 실제 NICE 연동 시 팝업 처리
        // TODO: 실제 NICE 계약 후 구현
        setError('NICE 본인인증 서비스 연동 준비 중입니다');
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      if (error.response?.data?.detail) {
        setError(error.response.data.detail);
      } else {
        setError('본인인증 중 오류가 발생했습니다');
      }
    } finally {
      setNiceAuthLoading(false);
    }
  };

  // 최종 회원가입
  const handleRegister = async () => {
    if (!verificationToken) {
      setError('본인인증이 필요합니다');
      return;
    }

    // 인증 만료 확인
    if (verificationExpires && new Date() > verificationExpires) {
      setError('본인인증이 만료되었습니다. 다시 인증해주세요.');
      setVerificationToken(null);
      setCurrentStep(3);
      return;
    }

    // Turnstile 검증 (Site Key가 설정된 경우에만)
    if (TURNSTILE_SITE_KEY && !turnstileToken) {
      setError('보안 검증을 완료해주세요');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await apiRegister(
        username,
        password,
        shopName,
        verificationToken,
        email || undefined,
        turnstileToken || undefined
      );
      await login(response.access_token);
      navigate('/');
    } catch (err: unknown) {
      const error = err as { response?: { status?: number; data?: { detail?: string } } };
      if (error.response?.data?.detail) {
        setError(error.response.data.detail);
      } else {
        setError('회원가입 중 오류가 발생했습니다');
      }
      // Turnstile 리셋
      turnstileRef.current?.reset();
      setTurnstileToken(null);
    } finally {
      setIsLoading(false);
    }
  };

  // 다음 단계로
  const handleNext = () => {
    if (currentStep === 1 && validateStep1()) {
      setCurrentStep(2);
    } else if (currentStep === 2 && validateStep2()) {
      setCurrentStep(3);
    } else if (currentStep === 3 && verificationToken) {
      setCurrentStep(4);
    }
  };

  // 이전 단계로
  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((currentStep - 1) as Step);
      setError('');
    }
  };

  // 아이디 변경 시 중복 확인 초기화
  const handleUsernameChange = (value: string) => {
    setUsername(value.toLowerCase());
    setUsernameChecked(false);
    setUsernameAvailable(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-50 to-secondary-100 dark:from-[#1a1412] dark:to-[#2d2420] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* 로고 */}
        <div className="text-center mb-6">
          <span className="text-5xl">☕</span>
          <h1 className="text-heading-2 text-primary-700 dark:text-primary-400 mt-3">
            카페 선결제
          </h1>
        </div>

        {/* 진행 단계 표시 */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {[1, 2, 3, 4].map((step) => (
            <div key={step} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  step < currentStep
                    ? 'bg-green-500 text-white'
                    : step === currentStep
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                }`}
              >
                {step < currentStep ? <Check className="w-4 h-4" /> : step}
              </div>
              {step < 4 && (
                <div
                  className={`w-8 h-1 mx-1 rounded ${
                    step < currentStep
                      ? 'bg-green-500'
                      : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* 회원가입 카드 */}
        <div className="bg-white dark:bg-[#2d2420] rounded-modal shadow-modal p-6">
          {/* Step 1: 아이디/비밀번호 */}
          {currentStep === 1 && (
            <>
              <h2 className="text-heading-3 text-center text-gray-900 dark:text-white mb-6">
                계정 정보 입력
              </h2>

              <div className="space-y-4">
                {/* 아이디 입력 */}
                <div>
                  <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    아이디
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        id="username"
                        type="text"
                        value={username}
                        onChange={(e) => handleUsernameChange(e.target.value)}
                        placeholder="영문 소문자 + 숫자"
                        required
                        minLength={4}
                        maxLength={20}
                        className="w-full pl-10 pr-4 py-3 rounded-button border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#1a1412] text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleCheckUsername}
                      disabled={checkingUsername || !username || username.length < 4}
                      className="px-4 py-3 rounded-button font-medium transition-colors bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                    >
                      {checkingUsername ? '확인 중...' : '중복확인'}
                    </button>
                  </div>
                  {usernameChecked && (
                    <p className={`mt-1 text-xs flex items-center gap-1 ${usernameAvailable ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                      {usernameAvailable ? (
                        <>
                          <Check className="w-3 h-3" />
                          사용 가능한 아이디입니다
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-3 h-3" />
                          이미 사용 중인 아이디입니다
                        </>
                      )}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    4~20자, 영문 소문자와 숫자만 사용
                  </p>
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
              </div>
            </>
          )}

          {/* Step 2: 상점 정보 */}
          {currentStep === 2 && (
            <>
              <h2 className="text-heading-3 text-center text-gray-900 dark:text-white mb-6">
                상점 정보 입력
              </h2>

              <div className="space-y-4">
                {/* 상점명 입력 */}
                <div>
                  <label htmlFor="shopName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    상점명 <span className="text-red-500">*</span>
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

                {/* 이메일 입력 (선택) */}
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    이메일 <span className="text-gray-400 text-xs">(선택)</span>
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="cafe@example.com"
                      className="w-full pl-10 pr-4 py-3 rounded-button border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#1a1412] text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    비밀번호 분실 시 재설정에 사용됩니다
                  </p>
                </div>
              </div>
            </>
          )}

          {/* Step 3: 본인인증 */}
          {currentStep === 3 && (
            <>
              <h2 className="text-heading-3 text-center text-gray-900 dark:text-white mb-6">
                본인인증
              </h2>

              <div className="space-y-4">
                <div className="text-center py-6">
                  <Shield className="w-16 h-16 mx-auto text-primary-500 mb-4" />
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    안전한 서비스 이용을 위해<br />
                    본인인증이 필요합니다
                  </p>

                  {verificationToken ? (
                    <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                      <div className="flex items-center justify-center gap-2 text-green-600 dark:text-green-400">
                        <Check className="w-5 h-5" />
                        <span className="font-medium">본인인증 완료</span>
                      </div>
                      {verificationExpires && (
                        <p className="text-sm text-green-600 dark:text-green-400 mt-2">
                          {Math.ceil((verificationExpires.getTime() - Date.now()) / 60000)}분 내에 가입을 완료해주세요
                        </p>
                      )}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleStartNiceAuth}
                      disabled={niceAuthLoading}
                      className="w-full min-h-touch flex items-center justify-center gap-2 px-4 py-3 rounded-button font-medium transition-colors bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {niceAuthLoading ? (
                        '인증 중...'
                      ) : (
                        <>
                          <Shield className="w-5 h-5" />
                          본인인증 하기
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Step 4: 최종 가입 */}
          {currentStep === 4 && (
            <>
              <h2 className="text-heading-3 text-center text-gray-900 dark:text-white mb-6">
                가입 완료
              </h2>

              <div className="space-y-4">
                {/* 입력 정보 요약 */}
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">아이디</span>
                    <span className="font-medium text-gray-900 dark:text-white">{username}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">상점명</span>
                    <span className="font-medium text-gray-900 dark:text-white">{shopName}</span>
                  </div>
                  {email && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">이메일</span>
                      <span className="font-medium text-gray-900 dark:text-white">{email}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">본인인증</span>
                    <span className="font-medium text-green-600 dark:text-green-400 flex items-center gap-1">
                      <Check className="w-4 h-4" />
                      완료
                    </span>
                  </div>
                </div>

                {/* Turnstile 봇 방지 */}
                {TURNSTILE_SITE_KEY && (
                  <div className="flex justify-center">
                    <Turnstile
                      ref={turnstileRef}
                      siteKey={TURNSTILE_SITE_KEY}
                      onSuccess={(token: string) => setTurnstileToken(token)}
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
              </div>
            </>
          )}

          {/* 에러 메시지 */}
          {error && (
            <p className="mt-4 text-sm text-red-500 dark:text-red-400 flex items-center gap-1">
              <AlertCircle className="w-4 h-4" />
              {error}
            </p>
          )}

          {/* 네비게이션 버튼 */}
          <div className="flex gap-3 mt-6">
            {currentStep > 1 && (
              <button
                type="button"
                onClick={handleBack}
                disabled={currentStep === 3 && verificationToken !== null}
                className="flex-1 min-h-touch flex items-center justify-center gap-2 px-4 py-3 rounded-button font-medium transition-colors bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-5 h-5" />
                이전
              </button>
            )}

            {currentStep < 4 ? (
              <button
                type="button"
                onClick={handleNext}
                disabled={currentStep === 3 && !verificationToken}
                className="flex-1 min-h-touch flex items-center justify-center gap-2 px-4 py-3 rounded-button font-medium transition-colors bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                다음
                <ChevronRight className="w-5 h-5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleRegister}
                disabled={isLoading}
                className="flex-1 min-h-touch flex items-center justify-center gap-2 px-4 py-3 rounded-button font-medium transition-colors bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? '가입 중...' : '회원가입 완료'}
              </button>
            )}
          </div>
        </div>

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

        {/* 하단 안내 */}
        <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-4">
          회원가입 시 서비스 이용약관에 동의하게 됩니다
        </p>
      </div>
    </div>
  );
}
