import { useState, useEffect } from 'react';
import { AlertTriangle, Clock, XCircle, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Subscription } from '../../types';
import { getSubscription } from '../../api/subscription';

export default function SubscriptionBanner() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    loadSubscription();
  }, []);

  const loadSubscription = async () => {
    try {
      const data = await getSubscription();
      setSubscription(data);
    } catch (error) {
      console.error('Failed to load subscription:', error);
    }
  };

  if (dismissed || !subscription) {
    return null;
  }

  // 표시가 필요한 상태인지 확인
  const shouldShowBanner = () => {
    switch (subscription.status) {
      case 'TRIAL':
        // 체험 기간 3일 이하 남은 경우 표시
        return subscription.days_remaining !== undefined && subscription.days_remaining <= 3;
      case 'GRACE':
      case 'SUSPENDED':
        return true;
      default:
        return false;
    }
  };

  if (!shouldShowBanner()) {
    return null;
  }

  const getBannerConfig = () => {
    switch (subscription.status) {
      case 'TRIAL':
        return {
          icon: Clock,
          bgColor: 'bg-primary-50 dark:bg-primary-900/30',
          borderColor: 'border-primary-200 dark:border-primary-700',
          iconColor: 'text-primary-500',
          textColor: 'text-primary-700 dark:text-primary-300',
          message: `무료 체험이 ${subscription.days_remaining}일 남았습니다. 결제 수단을 등록하여 서비스를 계속 이용하세요.`,
          linkText: '결제 수단 등록',
        };
      case 'GRACE':
        return {
          icon: AlertTriangle,
          bgColor: 'bg-warning-50 dark:bg-warning-900/30',
          borderColor: 'border-warning-200 dark:border-warning-700',
          iconColor: 'text-warning-500',
          textColor: 'text-warning-700 dark:text-warning-300',
          message: '결제에 실패했습니다. 유예 기간 내에 결제 수단을 확인해주세요.',
          linkText: '결제 수단 확인',
        };
      case 'SUSPENDED':
        return {
          icon: XCircle,
          bgColor: 'bg-error-50 dark:bg-error-900/30',
          borderColor: 'border-error-200 dark:border-error-700',
          iconColor: 'text-error-500',
          textColor: 'text-error-700 dark:text-error-300',
          message: '구독이 정지되었습니다. 서비스를 이용하려면 결제를 완료해주세요.',
          linkText: '결제하기',
        };
      default:
        return null;
    }
  };

  const config = getBannerConfig();
  if (!config) return null;

  const Icon = config.icon;

  return (
    <div className={`${config.bgColor} ${config.borderColor} border rounded-lg p-3 mb-4 relative`}>
      <div className="flex items-center gap-3">
        <Icon className={`w-5 h-5 ${config.iconColor} flex-shrink-0`} />
        <p className={`text-sm ${config.textColor} flex-1`}>
          {config.message}
        </p>
        <Link
          to="/settings"
          className={`text-sm font-medium ${config.textColor} hover:underline whitespace-nowrap`}
        >
          {config.linkText}
        </Link>
        <button
          onClick={() => setDismissed(true)}
          className={`${config.textColor} hover:opacity-70 p-1`}
          aria-label="닫기"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
