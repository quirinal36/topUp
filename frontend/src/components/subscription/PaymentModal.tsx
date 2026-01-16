import { useEffect, useRef, useState } from 'react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import { SubscriptionConfig } from '../../types';
import { registerBillingKey, startSubscription } from '../../api/subscription';
import { useToast } from '../../contexts/ToastContext';

declare global {
  interface Window {
    TossPayments: any;
  }
}

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  config: SubscriptionConfig;
}

export default function PaymentModal({ isOpen, onClose, onSuccess, config }: PaymentModalProps) {
  const toast = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [sdkLoaded, setSdkLoaded] = useState(false);
  const tossPaymentsRef = useRef<any>(null);

  useEffect(() => {
    if (!isOpen) return;

    // 토스페이먼츠 SDK 로드
    if (window.TossPayments) {
      setSdkLoaded(true);
      initTossPayments();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://js.tosspayments.com/v1/payment';
    script.async = true;
    script.onload = () => {
      setSdkLoaded(true);
      initTossPayments();
    };
    script.onerror = () => {
      toast.error('결제 모듈을 불러오는데 실패했습니다');
    };
    document.body.appendChild(script);

    return () => {
      // 스크립트 제거하지 않음 (재사용)
    };
  }, [isOpen]);

  const initTossPayments = async () => {
    try {
      // 클라이언트 키는 환경 변수에서 가져옴
      const clientKey = import.meta.env.VITE_TOSS_CLIENT_KEY;
      if (!clientKey) {
        console.error('Toss client key not configured');
        return;
      }
      tossPaymentsRef.current = window.TossPayments(clientKey);
    } catch (error) {
      console.error('Failed to init TossPayments:', error);
    }
  };

  const handleRegisterBillingKey = async () => {
    if (!tossPaymentsRef.current) {
      toast.error('결제 모듈이 준비되지 않았습니다');
      return;
    }

    setIsLoading(true);

    try {
      // 빌링키 발급을 위한 카드 등록 창 열기
      const result = await tossPaymentsRef.current.requestBillingAuth('카드', {
        customerKey: `customer_${Date.now()}`, // 임시 키, 서버에서 생성된 키 사용
        successUrl: `${window.location.origin}/settings?billing=success`,
        failUrl: `${window.location.origin}/settings?billing=fail`,
      });

      // 성공 시 authKey를 백엔드로 전송
      if (result.authKey) {
        await registerBillingKey(result.authKey);
        // 빌링키 등록 후 자동으로 첫 결제 시도
        await startSubscription();
        onSuccess();
      }
    } catch (error: any) {
      if (error.code === 'USER_CANCEL') {
        toast.info('결제가 취소되었습니다');
      } else {
        toast.error(error.message || '결제 수단 등록에 실패했습니다');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="결제 수단 등록">
      <div className="space-y-6">
        {/* 구독 정보 */}
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
          <h3 className="font-medium text-gray-900 dark:text-white mb-3">구독 정보</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">월 구독료</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {config.monthly_price.toLocaleString()}원
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">무료 체험</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {config.trial_days}일
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">결제 실패 유예</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {config.grace_period_days}일
              </span>
            </div>
          </div>
        </div>

        {/* 안내 문구 */}
        <div className="text-sm text-gray-500 dark:text-gray-400 space-y-2">
          <p>* 카드 정보는 토스페이먼츠에서 안전하게 관리됩니다.</p>
          <p>* 무료 체험 기간 중에는 결제되지 않습니다.</p>
          <p>* 구독은 언제든지 취소할 수 있습니다.</p>
        </div>

        {/* 버튼 */}
        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1">
            취소
          </Button>
          <Button
            onClick={handleRegisterBillingKey}
            isLoading={isLoading}
            disabled={!sdkLoaded}
            className="flex-1"
          >
            {sdkLoaded ? '카드 등록하기' : '로딩 중...'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
