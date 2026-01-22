import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Store, FileText, ArrowRight, CheckCircle, XCircle, Loader2, LogIn, KeyRound } from 'lucide-react';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Card from '../../components/common/Card';
import { useOnboardingStore } from '../../stores/onboardingStore';
import { useAuthStore } from '../../stores/authStore';
import { updateStep1, verifyBusinessNumber, checkBusinessNumberDuplicate, BusinessDuplicateResponse } from '../../api/onboarding';
import { useToast } from '../../contexts/ToastContext';

interface OnboardingStep1Props {
  onNext: () => void;
}

type VerificationStatus = 'idle' | 'loading' | 'success' | 'error' | 'duplicate';

export default function OnboardingStep1({ onNext }: OnboardingStep1Props) {
  const navigate = useNavigate();
  const toast = useToast();
  const { shopName: authShopName } = useAuthStore();
  const { shopName, businessNumber, setStep1Data } = useOnboardingStore();

  const [name, setName] = useState(shopName || authShopName || '');
  const [bizNumber, setBizNumber] = useState(businessNumber);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // 사업자등록번호 검증 상태
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>('idle');
  const [verificationMessage, setVerificationMessage] = useState('');
  const [verificationTaxType, setVerificationTaxType] = useState('');
  const [isBusinessVerified, setIsBusinessVerified] = useState(false);

  // 중복 시 기존 사용자 정보
  const [duplicateInfo, setDuplicateInfo] = useState<{
    username?: string;
    shopName?: string;
  } | null>(null);

  useEffect(() => {
    if (!shopName && authShopName) {
      setName(authShopName);
    }
  }, [shopName, authShopName]);

  // 사업자등록번호 자동 포맷팅
  const handleBizNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, ''); // 숫자만 추출

    if (value.length <= 10) {
      // xxx-xx-xxxxx 형식으로 포맷팅
      let formatted = value;
      if (value.length > 3) {
        formatted = value.slice(0, 3) + '-' + value.slice(3);
      }
      if (value.length > 5) {
        formatted = value.slice(0, 3) + '-' + value.slice(3, 5) + '-' + value.slice(5);
      }
      setBizNumber(formatted);

      // 검증 상태 초기화
      setVerificationStatus('idle');
      setVerificationMessage('');
      setVerificationTaxType('');
      setIsBusinessVerified(false);
      setDuplicateInfo(null);
    }
  };

  // 사업자등록번호 검증
  const handleVerifyBizNumber = async () => {
    const digits = bizNumber.replace(/\D/g, '');

    if (digits.length !== 10) {
      setVerificationStatus('error');
      setVerificationMessage('사업자등록번호 10자리를 입력해주세요');
      return;
    }

    setVerificationStatus('loading');
    setVerificationMessage('');
    setVerificationTaxType('');
    setError('');
    setDuplicateInfo(null);

    try {
      // 1. 국세청 API로 유효성 검증
      const verifyResult = await verifyBusinessNumber(bizNumber);

      if (!verifyResult.is_valid) {
        setVerificationStatus('error');
        setVerificationMessage(verifyResult.message);
        setIsBusinessVerified(false);
        return;
      }

      // 2. 중복 검사
      const duplicateResult: BusinessDuplicateResponse = await checkBusinessNumberDuplicate(bizNumber);

      if (duplicateResult.is_duplicate) {
        setVerificationStatus('duplicate');
        setVerificationMessage(duplicateResult.message);
        setDuplicateInfo({
          username: duplicateResult.existing_username,
          shopName: duplicateResult.existing_shop_name,
        });
        setIsBusinessVerified(false);
        return;
      }

      // 검증 성공 - 과세유형 정보 표시
      setVerificationStatus('success');
      setVerificationMessage(verifyResult.message);
      setVerificationTaxType(verifyResult.tax_type || '');
      setIsBusinessVerified(true);
    } catch (err: unknown) {
      setVerificationStatus('error');
      const message =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        '검증 중 오류가 발생했습니다';
      setVerificationMessage(message);
      setIsBusinessVerified(false);
    }
  };

  const handleSubmit = async () => {
    // 유효성 검사
    if (!name.trim()) {
      setError('상점명을 입력해주세요');
      return;
    }

    // 사업자등록번호 필수 검사
    const bizDigits = bizNumber.replace(/\D/g, '');
    if (bizDigits.length !== 10) {
      setError('사업자등록번호 10자리를 입력해주세요');
      return;
    }

    // 사업자등록번호 검증 여부 확인
    if (!isBusinessVerified) {
      setError('사업자등록번호 검증을 먼저 진행해주세요');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await updateStep1({
        name: name.trim(),
        business_number: bizNumber,
        is_business_verified: isBusinessVerified,
      });

      setStep1Data(name.trim(), bizNumber);
      toast.success('상점 정보가 저장되었습니다');
      onNext();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || '저장에 실패했습니다';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoToLogin = () => {
    navigate('/login');
  };

  const handleGoToForgotPassword = () => {
    navigate('/forgot-password');
  };

  const renderVerificationStatus = () => {
    switch (verificationStatus) {
      case 'loading':
        return (
          <div className="flex items-center gap-2 text-primary-600 dark:text-primary-400">
            <Loader2 size={16} className="animate-spin" />
            <span className="text-sm">검증 중...</span>
          </div>
        );
      case 'success':
        return (
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-success-600 dark:text-success-400">
              <CheckCircle size={16} />
              <span className="text-sm">{verificationMessage}</span>
            </div>
            {verificationTaxType && (
              <p className="text-sm text-gray-600 dark:text-gray-400 ml-6">
                과세유형: {verificationTaxType}
              </p>
            )}
          </div>
        );
      case 'error':
        return (
          <div className="flex items-center gap-2 text-error-600 dark:text-error-400">
            <XCircle size={16} />
            <span className="text-sm">{verificationMessage}</span>
          </div>
        );
      case 'duplicate':
        return (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-warning-600 dark:text-warning-400">
              <XCircle size={16} />
              <span className="text-sm">{verificationMessage}</span>
            </div>
            {duplicateInfo && (
              <div className="bg-warning-50 dark:bg-warning-900/20 border border-warning-200 dark:border-warning-800 rounded-lg p-4">
                <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                  {duplicateInfo.shopName && (
                    <>
                      상점명: <strong>{duplicateInfo.shopName}</strong>
                      <br />
                    </>
                  )}
                  {duplicateInfo.username && (
                    <>
                      사용자 ID: <strong>{duplicateInfo.username}</strong>
                    </>
                  )}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={handleGoToLogin}
                    className="flex items-center gap-1"
                  >
                    <LogIn size={14} />
                    로그인하기
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleGoToForgotPassword}
                    className="flex items-center gap-1"
                  >
                    <KeyRound size={14} />
                    비밀번호 찾기
                  </Button>
                </div>
              </div>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <Card className="p-6 sm:p-8">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-100 rounded-full mb-4">
          <Store className="w-8 h-8 text-primary-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          상점 정보 입력
        </h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          상점의 기본 정보를 입력해주세요
        </p>
      </div>

      <div className="space-y-4">
        <Input
          label="상점명"
          placeholder="예: 카페 아메리카노"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
          required
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            사업자등록번호 <span className="text-error-500">*</span>
          </label>
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                placeholder="000-00-00000"
                value={bizNumber}
                onChange={handleBizNumberChange}
                maxLength={12}
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={handleVerifyBizNumber}
              disabled={bizNumber.replace(/\D/g, '').length !== 10 || verificationStatus === 'loading'}
              className="whitespace-nowrap"
            >
              {verificationStatus === 'loading' ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                '검증'
              )}
            </Button>
          </div>

          <div className="mt-2">
            {renderVerificationStatus()}
          </div>

          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
            <FileText size={12} />
            사업자등록번호는 필수 항목입니다. 국세청에 등록된 유효한 번호를 입력해주세요.
          </p>
        </div>

        {error && (
          <p className="text-sm text-error-600 dark:text-error-400">{error}</p>
        )}
      </div>

      <div className="mt-8 flex justify-end">
        <Button
          onClick={handleSubmit}
          isLoading={isLoading}
          disabled={!isBusinessVerified}
          className="min-w-[120px]"
        >
          다음
          <ArrowRight size={16} className="ml-1" />
        </Button>
      </div>
    </Card>
  );
}
