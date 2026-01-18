import { useState, useEffect } from 'react';
import { Store, FileText, ArrowRight } from 'lucide-react';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Card from '../../components/common/Card';
import { useOnboardingStore } from '../../stores/onboardingStore';
import { useAuthStore } from '../../stores/authStore';
import { updateStep1 } from '../../api/onboarding';
import { useToast } from '../../contexts/ToastContext';

interface OnboardingStep1Props {
  onNext: () => void;
}

export default function OnboardingStep1({ onNext }: OnboardingStep1Props) {
  const toast = useToast();
  const { shopName: authShopName } = useAuthStore();
  const { shopName, businessNumber, setStep1Data } = useOnboardingStore();

  const [name, setName] = useState(shopName || authShopName || '');
  const [bizNumber, setBizNumber] = useState(businessNumber);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

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
    }
  };

  const handleSubmit = async () => {
    // 유효성 검사
    if (!name.trim()) {
      setError('상점명을 입력해주세요');
      return;
    }

    // 사업자등록번호가 있으면 10자리 검증
    const bizDigits = bizNumber.replace(/\D/g, '');
    if (bizNumber && bizDigits.length !== 10) {
      setError('사업자등록번호는 10자리 숫자입니다');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await updateStep1({
        name: name.trim(),
        business_number: bizNumber || undefined,
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
          <Input
            label="사업자등록번호"
            placeholder="000-00-00000"
            value={bizNumber}
            onChange={handleBizNumberChange}
            maxLength={12}
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
            <FileText size={12} />
            선택 사항입니다. 나중에 설정에서 입력할 수 있습니다.
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
          className="min-w-[120px]"
        >
          다음
          <ArrowRight size={16} className="ml-1" />
        </Button>
      </div>
    </Card>
  );
}
