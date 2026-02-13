import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, ArrowLeft, CheckCircle, Building2 } from 'lucide-react';
import {
  requestPasswordReset,
  verifyResetCode,
  confirmPasswordReset,
  findEmailByBusinessNumber,
  requestPasswordResetByBusinessNumber,
} from '../api/auth';

type Step = 'email' | 'find-email' | 'code' | 'password' | 'complete';

export default function ForgotPassword() {
  const navigate = useNavigate();

  // 단계 상태
  const [step, setStep] = useState<Step>('email');

  // 폼 데이터
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // 사업자등록번호 관련
  const [businessNumber, setBusinessNumber] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');

  // UI 상태
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [remainingTime, setRemainingTime] = useState(0);

  // Refs
  const codeInputRef = useRef<HTMLInputElement>(null);

  // 타이머 효과
  useEffect(() => {
    if (remainingTime > 0) {
      const timer = setInterval(() => {
        setRemainingTime((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [remainingTime]);

  // 인증번호 입력 단계로 이동 시 자동 포커스
  useEffect(() => {
    if (step === 'code' && codeInputRef.current) {
      codeInputRef.current.focus();
    }
  }, [step]);

  // 비밀번호 유효성 검사
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

  // 시간 포맷팅
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // 사업자등록번호 포맷팅 (xxx-xx-xxxxx)
  const formatBusinessNumber = (value: string): string => {
    const digits = value.replace(/\D/g, '').slice(0, 10);
    if (digits.length <= 3) return digits;
    if (digits.length <= 5) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
  };

  // Step 1: 이메일 입력 후 인증번호 발송
  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await requestPasswordReset(email);
      if (!response.email_exists) {
        setError(response.message);
        return;
      }
      setRemainingTime(response.expires_in || 600);
      setStep('code');
    } catch (err: unknown) {
      const error = err as { response?: { status?: number; data?: { detail?: string } } };
      if (error.response?.status === 429) {
        setError('너무 많은 요청입니다. 잠시 후 다시 시도해주세요.');
      } else {
        setError(error.response?.data?.detail || '인증번호 발송 중 오류가 발생했습니다');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 사업자등록번호로 이메일 조회
  const handleFindEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMaskedEmail('');
    setIsLoading(true);

    const digits = businessNumber.replace(/\D/g, '');
    if (digits.length !== 10) {
      setError('사업자등록번호 10자리를 입력해주세요.');
      setIsLoading(false);
      return;
    }

    try {
      const response = await findEmailByBusinessNumber(digits);
      if (response.found && response.masked_email) {
        setMaskedEmail(response.masked_email);
      } else {
        setError(response.message);
      }
    } catch (err: unknown) {
      const error = err as { response?: { status?: number; data?: { detail?: string } } };
      if (error.response?.status === 429) {
        setError('너무 많은 요청입니다. 잠시 후 다시 시도해주세요.');
      } else {
        setError(error.response?.data?.detail || '이메일 조회 중 오류가 발생했습니다');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 사업자등록번호로 찾은 이메일에 인증번호 발송
  const handleSendCodeByBusinessNumber = async () => {
    setError('');
    setIsLoading(true);

    const digits = businessNumber.replace(/\D/g, '');

    try {
      const response = await requestPasswordResetByBusinessNumber(digits);
      if (!response.email_exists) {
        setError(response.message);
        return;
      }
      // 서버에서 반환한 실제 이메일 저장 (verify/confirm 단계에서 사용)
      if (response.email) {
        setEmail(response.email);
      }
      setRemainingTime(response.expires_in || 600);
      setStep('code');
    } catch (err: unknown) {
      const error = err as { response?: { status?: number; data?: { detail?: string } } };
      if (error.response?.status === 429) {
        setError('너무 많은 요청입니다. 잠시 후 다시 시도해주세요.');
      } else {
        setError(error.response?.data?.detail || '인증번호 발송 중 오류가 발생했습니다');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: 인증번호 검증
  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await verifyResetCode(email, code);

      if (response.verified && response.reset_token) {
        setResetToken(response.reset_token);
        setStep('password');
      } else {
        if (response.locked_until) {
          setError('너무 많은 시도입니다. 잠시 후 다시 시도해주세요.');
        } else if (response.remaining_attempts === 0) {
          setError('인증번호 입력 횟수를 초과했습니다. 다시 요청해주세요.');
          setStep('email');
          setCode('');
        } else {
          setError(`인증번호가 올바르지 않습니다. (남은 시도: ${response.remaining_attempts}회)`);
        }
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      setError(error.response?.data?.detail || '인증번호 검증 중 오류가 발생했습니다');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 3: 새 비밀번호 설정
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // 유효성 검사
    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다');
      return;
    }

    setIsLoading(true);

    try {
      await confirmPasswordReset(email, resetToken, newPassword);
      setStep('complete');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      if (error.response?.data?.detail) {
        setError(error.response.data.detail);
      } else {
        setError('비밀번호 변경 중 오류가 발생했습니다');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 인증번호 재발송
  const handleResendCode = async () => {
    setError('');
    setIsLoading(true);
    setCode('');

    try {
      const response = await requestPasswordReset(email);
      setRemainingTime(response.expires_in || 600);
    } catch (err: unknown) {
      const error = err as { response?: { status?: number } };
      if (error.response?.status === 429) {
        setError('너무 많은 요청입니다. 잠시 후 다시 시도해주세요.');
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
              커밍스
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              비밀번호 재설정
            </p>
          </div>

          {/* 카드 */}
          <div className="bg-white dark:bg-[#2d2420] rounded-modal shadow-modal p-6">
            {/* Step 1: 이메일 입력 */}
            {step === 'email' && (
              <>
                <h2 className="text-heading-3 text-center text-gray-900 dark:text-white mb-2">
                  비밀번호 찾기
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-6">
                  가입하신 이메일로 인증번호를 발송합니다
                </p>

                <form onSubmit={handleRequestCode} className="space-y-4">
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

                  {error && (
                    <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
                  )}

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full min-h-touch flex items-center justify-center gap-2 px-4 py-3 rounded-button font-medium transition-colors bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? '발송 중...' : '인증번호 발송'}
                  </button>
                </form>

                {/* 사업자등록번호로 이메일 찾기 링크 */}
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <button
                    type="button"
                    onClick={() => {
                      setError('');
                      setStep('find-email');
                    }}
                    className="w-full flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                  >
                    <Building2 className="w-4 h-4" />
                    이메일을 모르시나요? 사업자등록번호로 찾기
                  </button>
                </div>
              </>
            )}

            {/* Step: 사업자등록번호로 이메일 찾기 */}
            {step === 'find-email' && (
              <>
                <h2 className="text-heading-3 text-center text-gray-900 dark:text-white mb-2">
                  이메일 찾기
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-6">
                  사업자등록번호로 등록된 이메일을 찾습니다
                </p>

                <form onSubmit={handleFindEmail} className="space-y-4">
                  <div>
                    <label htmlFor="businessNumber" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      사업자등록번호
                    </label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        id="businessNumber"
                        type="text"
                        inputMode="numeric"
                        value={businessNumber}
                        onChange={(e) => setBusinessNumber(formatBusinessNumber(e.target.value))}
                        placeholder="000-00-00000"
                        maxLength={12}
                        required
                        className="w-full pl-10 pr-4 py-3 rounded-button border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#1a1412] text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  {error && (
                    <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
                  )}

                  {/* 조회 결과: 마스킹된 이메일 표시 */}
                  {maskedEmail && (
                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                      <p className="text-sm text-green-800 dark:text-green-300 mb-1">
                        등록된 이메일을 찾았습니다
                      </p>
                      <p className="text-lg font-medium text-green-900 dark:text-green-200 text-center">
                        {maskedEmail}
                      </p>
                    </div>
                  )}

                  {!maskedEmail ? (
                    <button
                      type="submit"
                      disabled={isLoading || businessNumber.replace(/\D/g, '').length !== 10}
                      className="w-full min-h-touch flex items-center justify-center gap-2 px-4 py-3 rounded-button font-medium transition-colors bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isLoading ? '조회 중...' : '이메일 조회'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSendCodeByBusinessNumber}
                      disabled={isLoading}
                      className="w-full min-h-touch flex items-center justify-center gap-2 px-4 py-3 rounded-button font-medium transition-colors bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isLoading ? '발송 중...' : '이 이메일로 인증번호 보내기'}
                    </button>
                  )}
                </form>

                {/* 이메일로 찾기로 돌아가기 */}
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <button
                    type="button"
                    onClick={() => {
                      setError('');
                      setMaskedEmail('');
                      setStep('email');
                    }}
                    className="w-full flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                  >
                    <Mail className="w-4 h-4" />
                    이메일로 직접 찾기
                  </button>
                </div>
              </>
            )}

            {/* Step 2: 인증번호 입력 */}
            {step === 'code' && (
              <>
                <h2 className="text-heading-3 text-center text-gray-900 dark:text-white mb-2">
                  인증번호 입력
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-6">
                  이메일로 발송된 6자리 인증번호를 입력하세요
                </p>

                <form onSubmit={handleVerifyCode} className="space-y-4">
                  <div>
                    <label htmlFor="code" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      인증번호
                    </label>
                    <input
                      ref={codeInputRef}
                      id="code"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="000000"
                      required
                      className="w-full px-4 py-3 text-center text-2xl tracking-[0.5em] rounded-button border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#1a1412] text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>

                  {/* 남은 시간 표시 */}
                  {remainingTime > 0 && (
                    <p className="text-sm text-center text-gray-500 dark:text-gray-400">
                      남은 시간: <span className="font-medium text-primary-600 dark:text-primary-400">{formatTime(remainingTime)}</span>
                    </p>
                  )}

                  {remainingTime === 0 && (
                    <p className="text-sm text-center text-red-500 dark:text-red-400">
                      인증번호가 만료되었습니다
                    </p>
                  )}

                  {error && (
                    <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
                  )}

                  <button
                    type="submit"
                    disabled={isLoading || code.length !== 6 || remainingTime === 0}
                    className="w-full min-h-touch flex items-center justify-center gap-2 px-4 py-3 rounded-button font-medium transition-colors bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? '확인 중...' : '확인'}
                  </button>

                  <button
                    type="button"
                    onClick={handleResendCode}
                    disabled={isLoading}
                    className="w-full min-h-touch flex items-center justify-center gap-2 px-4 py-3 rounded-button font-medium transition-colors border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    인증번호 재발송
                  </button>
                </form>
              </>
            )}

            {/* Step 3: 새 비밀번호 입력 */}
            {step === 'password' && (
              <>
                <h2 className="text-heading-3 text-center text-gray-900 dark:text-white mb-2">
                  새 비밀번호 설정
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-6">
                  새로 사용할 비밀번호를 입력하세요
                </p>

                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div>
                    <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      새 비밀번호
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        id="newPassword"
                        type={showNewPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="8자 이상, 영문+숫자"
                        required
                        minLength={8}
                        className="w-full pl-10 pr-12 py-3 rounded-button border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#1a1412] text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      8자 이상, 영문과 숫자를 포함해주세요
                    </p>
                  </div>

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

                  {error && (
                    <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
                  )}

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full min-h-touch flex items-center justify-center gap-2 px-4 py-3 rounded-button font-medium transition-colors bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? '변경 중...' : '비밀번호 변경'}
                  </button>
                </form>
              </>
            )}

            {/* Step 4: 완료 */}
            {step === 'complete' && (
              <div className="text-center py-4">
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h2 className="text-heading-3 text-gray-900 dark:text-white mb-2">
                  비밀번호 변경 완료
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                  새 비밀번호로 로그인해주세요
                </p>
                <button
                  onClick={() => navigate('/login')}
                  className="w-full min-h-touch flex items-center justify-center gap-2 px-4 py-3 rounded-button font-medium transition-colors bg-primary-600 text-white hover:bg-primary-700"
                >
                  로그인하기
                </button>
              </div>
            )}

            {/* 뒤로가기 링크 */}
            {step !== 'complete' && (
              <div className="mt-6 text-center">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400"
                >
                  <ArrowLeft className="w-4 h-4" />
                  로그인으로 돌아가기
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
