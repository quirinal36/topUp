import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import StepIndicator from './StepIndicator';
import OnboardingStep1 from './OnboardingStep1';
import OnboardingStep2 from './OnboardingStep2';
import OnboardingStep3 from './OnboardingStep3';
import { useOnboardingStore } from '../../stores/onboardingStore';
import { useAuthStore } from '../../stores/authStore';
import { completeOnboarding } from '../../api/onboarding';
import { useToast } from '../../contexts/ToastContext';

export default function Onboarding() {
  const navigate = useNavigate();
  const toast = useToast();
  const { currentStep, setStep, reset } = useOnboardingStore();
  const { setOnboardingCompleted, setShopName, shopName } = useAuthStore();

  // 컴포넌트 마운트 시 스토어 초기화
  useEffect(() => {
    // 상점명이 이미 있으면 Step1 데이터에 설정
    if (shopName) {
      useOnboardingStore.getState().setStep1Data(shopName, '');
    }
  }, [shopName]);

  const handleComplete = async () => {
    try {
      await completeOnboarding();
      setOnboardingCompleted(true);

      // 온보딩에서 입력한 상점명으로 업데이트
      const { shopName: newShopName } = useOnboardingStore.getState();
      if (newShopName) {
        setShopName(newShopName);
      }

      // 스토어 리셋
      reset();

      toast.success('온보딩이 완료되었습니다! 환영합니다!');
      navigate('/', { replace: true });
    } catch (err) {
      toast.error('온보딩 완료 처리에 실패했습니다');
      console.error('Onboarding complete error:', err);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-50 to-secondary-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="pt-8 pb-4 text-center">
        <div className="inline-flex items-center gap-2 text-primary-600 dark:text-primary-400">
          <Sparkles size={24} />
          <span className="text-lg font-bold">시작하기</span>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-lg mx-auto px-4 pb-8">
        <StepIndicator currentStep={currentStep} totalSteps={3} />

        {currentStep === 1 && (
          <OnboardingStep1 onNext={() => setStep(2)} />
        )}

        {currentStep === 2 && (
          <OnboardingStep2
            onBack={() => setStep(1)}
            onNext={() => setStep(3)}
          />
        )}

        {currentStep === 3 && (
          <OnboardingStep3
            onBack={() => setStep(2)}
            onComplete={handleComplete}
          />
        )}

        {/* Help text */}
        <p className="mt-6 text-center text-xs text-gray-500 dark:text-gray-400">
          언제든지 설정에서 정보를 수정할 수 있습니다
        </p>
      </div>
    </div>
  );
}
