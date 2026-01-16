import { useState, useEffect } from 'react';
import { CreditCard, Calendar, AlertTriangle, CheckCircle, Clock, XCircle } from 'lucide-react';
import Card from '../common/Card';
import Button from '../common/Button';
import { Subscription, SubscriptionConfig, PaymentHistory } from '../../types';
import { getSubscription, getSubscriptionConfig, getPaymentHistory, startSubscription, cancelSubscription } from '../../api/subscription';
import { useToast } from '../../contexts/ToastContext';
import PaymentModal from './PaymentModal';

const STATUS_CONFIG = {
  TRIAL: {
    label: '무료 체험',
    color: 'text-primary-500',
    bgColor: 'bg-primary-50 dark:bg-primary-900/20',
    borderColor: 'border-primary-200 dark:border-primary-800',
    icon: Clock,
  },
  ACTIVE: {
    label: '구독 중',
    color: 'text-success-500',
    bgColor: 'bg-success-50 dark:bg-success-900/20',
    borderColor: 'border-success-200 dark:border-success-800',
    icon: CheckCircle,
  },
  GRACE: {
    label: '유예 기간',
    color: 'text-warning-500',
    bgColor: 'bg-warning-50 dark:bg-warning-900/20',
    borderColor: 'border-warning-200 dark:border-warning-800',
    icon: AlertTriangle,
  },
  SUSPENDED: {
    label: '정지됨',
    color: 'text-error-500',
    bgColor: 'bg-error-50 dark:bg-error-900/20',
    borderColor: 'border-error-200 dark:border-error-800',
    icon: XCircle,
  },
  CANCELLED: {
    label: '취소됨',
    color: 'text-gray-500',
    bgColor: 'bg-gray-50 dark:bg-gray-900/20',
    borderColor: 'border-gray-200 dark:border-gray-800',
    icon: XCircle,
  },
};

export default function SubscriptionCard() {
  const toast = useToast();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [config, setConfig] = useState<SubscriptionConfig | null>(null);
  const [payments, setPayments] = useState<PaymentHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);

  useEffect(() => {
    loadSubscriptionData();
  }, []);

  const loadSubscriptionData = async () => {
    try {
      const [subData, configData, paymentData] = await Promise.all([
        getSubscription(),
        getSubscriptionConfig(),
        getPaymentHistory(5),
      ]);
      setSubscription(subData);
      setConfig(configData);
      setPayments(paymentData);
    } catch (error) {
      console.error('Failed to load subscription data:', error);
      toast.error('구독 정보를 불러오는데 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  const handleStartSubscription = async () => {
    if (!subscription?.has_billing_key) {
      setIsPaymentModalOpen(true);
      return;
    }

    setIsSubscribing(true);
    try {
      const result = await startSubscription();
      setSubscription(result.subscription);
      toast.success('구독이 시작되었습니다');
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || '구독 시작에 실패했습니다';
      toast.error(errorMsg);
    } finally {
      setIsSubscribing(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!confirm('정말 구독을 취소하시겠습니까? 현재 결제 기간이 끝나면 서비스 이용이 제한됩니다.')) {
      return;
    }

    setIsCancelling(true);
    try {
      const result = await cancelSubscription();
      setSubscription(result.subscription);
      toast.success('구독이 취소되었습니다');
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || '구독 취소에 실패했습니다';
      toast.error(errorMsg);
    } finally {
      setIsCancelling(false);
    }
  };

  const handlePaymentSuccess = () => {
    setIsPaymentModalOpen(false);
    loadSubscriptionData();
    toast.success('결제 수단이 등록되었습니다');
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('ko-KR');
  };

  if (loading) {
    return (
      <Card>
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
          <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
        </div>
      </Card>
    );
  }

  if (!subscription || !config) {
    return null;
  }

  const statusConfig = STATUS_CONFIG[subscription.status];
  const StatusIcon = statusConfig.icon;

  return (
    <>
      <Card className={`${statusConfig.bgColor} ${statusConfig.borderColor} border-2`}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-heading-3 text-gray-900 dark:text-white mb-2">구독 관리</h2>
            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${statusConfig.bgColor}`}>
              <StatusIcon className={`w-4 h-4 ${statusConfig.color}`} />
              <span className={`text-sm font-medium ${statusConfig.color}`}>
                {statusConfig.label}
              </span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {config.monthly_price.toLocaleString()}원
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">/ 월</p>
          </div>
        </div>

        {/* 상태별 정보 표시 */}
        <div className="space-y-3 mb-6">
          {subscription.status === 'TRIAL' && (
            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
              <Calendar className="w-4 h-4" />
              <span>
                체험 기간: {formatDate(subscription.trial_start_date)} ~ {formatDate(subscription.trial_end_date)}
              </span>
            </div>
          )}

          {(subscription.status === 'ACTIVE' || subscription.status === 'CANCELLED') && (
            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
              <Calendar className="w-4 h-4" />
              <span>
                현재 구독 기간: {formatDate(subscription.current_period_start)} ~ {formatDate(subscription.current_period_end)}
              </span>
            </div>
          )}

          {subscription.status === 'GRACE' && (
            <div className="flex items-center gap-2 text-warning-600 dark:text-warning-400">
              <AlertTriangle className="w-4 h-4" />
              <span>
                결제 실패! {formatDate(subscription.grace_period_end)}까지 결제를 완료해주세요.
              </span>
            </div>
          )}

          {subscription.status === 'SUSPENDED' && (
            <div className="flex items-center gap-2 text-error-600 dark:text-error-400">
              <XCircle className="w-4 h-4" />
              <span>
                서비스가 정지되었습니다. 결제 수단을 등록하여 구독을 재개해주세요.
              </span>
            </div>
          )}

          {subscription.days_remaining !== undefined && subscription.days_remaining >= 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              남은 일수: <span className="font-medium">{subscription.days_remaining}일</span>
            </p>
          )}

          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
            <CreditCard className="w-4 h-4" />
            <span>
              결제 수단: {subscription.has_billing_key ? '등록됨' : '미등록'}
            </span>
          </div>
        </div>

        {/* 액션 버튼 */}
        <div className="flex gap-3">
          {subscription.status === 'TRIAL' && (
            <>
              {subscription.has_billing_key ? (
                <Button onClick={handleStartSubscription} isLoading={isSubscribing}>
                  정기 구독 시작
                </Button>
              ) : (
                <Button onClick={() => setIsPaymentModalOpen(true)}>
                  결제 수단 등록
                </Button>
              )}
            </>
          )}

          {subscription.status === 'ACTIVE' && (
            <>
              <Button variant="outline" onClick={() => setIsPaymentModalOpen(true)}>
                결제 수단 변경
              </Button>
              <Button variant="error" onClick={handleCancelSubscription} isLoading={isCancelling}>
                구독 취소
              </Button>
            </>
          )}

          {subscription.status === 'GRACE' && (
            <Button onClick={() => setIsPaymentModalOpen(true)}>
              결제 수단 변경
            </Button>
          )}

          {subscription.status === 'SUSPENDED' && (
            <Button onClick={() => setIsPaymentModalOpen(true)}>
              결제 수단 등록하고 구독 재개
            </Button>
          )}

          {subscription.status === 'CANCELLED' && (
            <Button onClick={handleStartSubscription} isLoading={isSubscribing}>
              구독 재개
            </Button>
          )}
        </div>
      </Card>

      {/* 최근 결제 내역 */}
      {payments.length > 0 && (
        <Card className="mt-4">
          <h3 className="text-heading-4 text-gray-900 dark:text-white mb-4">최근 결제 내역</h3>
          <div className="space-y-3">
            {payments.map((payment) => (
              <div
                key={payment.id}
                className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0"
              >
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {payment.amount.toLocaleString()}원
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {formatDate(payment.created_at)}
                  </p>
                </div>
                <span
                  className={`px-2 py-1 rounded text-xs font-medium ${
                    payment.status === 'SUCCESS'
                      ? 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400'
                      : payment.status === 'FAILED'
                      ? 'bg-error-100 text-error-700 dark:bg-error-900/30 dark:text-error-400'
                      : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
                  }`}
                >
                  {payment.status === 'SUCCESS' ? '완료' : payment.status === 'FAILED' ? '실패' : payment.status}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 결제 모달 */}
      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        onSuccess={handlePaymentSuccess}
        config={config}
      />
    </>
  );
}
