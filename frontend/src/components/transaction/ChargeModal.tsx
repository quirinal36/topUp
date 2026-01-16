import { useState } from 'react';
import { CreditCard, Banknote, Building2 } from 'lucide-react';
import Modal from '../common/Modal';
import Input from '../common/Input';
import Button from '../common/Button';
import { PaymentMethod } from '../../types';
import { charge } from '../../api/transactions';
import { useToast } from '../../contexts/ToastContext';

interface ChargeModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerId: string;
  customerName: string;
  onSuccess: () => void;
}

export default function ChargeModal({
  isOpen,
  onClose,
  customerId,
  customerName,
  onSuccess,
}: ChargeModalProps) {
  const toast = useToast();
  const [actualPayment, setActualPayment] = useState('');
  const [serviceAmount, setServiceAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CARD');
  const [note, setNote] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const paymentMethods = [
    { value: 'CARD' as const, icon: CreditCard, label: '카드' },
    { value: 'CASH' as const, icon: Banknote, label: '현금' },
    { value: 'TRANSFER' as const, icon: Building2, label: '이체' },
  ];

  const totalAmount = (parseInt(actualPayment) || 0) + (parseInt(serviceAmount) || 0);

  const handleSubmit = async () => {
    if (!actualPayment || parseInt(actualPayment) <= 0) {
      setError('결제 금액을 입력해주세요');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await charge({
        customer_id: customerId,
        actual_payment: parseInt(actualPayment),
        service_amount: parseInt(serviceAmount) || 0,
        payment_method: paymentMethod,
        note: note || undefined,
      });
      toast.success(`${customerName}님에게 ${totalAmount.toLocaleString()}원이 충전되었습니다`);
      onSuccess();
      handleClose();
    } catch (err) {
      toast.error('충전에 실패했습니다');
      setError('충전에 실패했습니다');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setActualPayment('');
    setServiceAmount('');
    setPaymentMethod('CARD');
    setNote('');
    setError('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="충전" size="md">
      <div className="space-y-4">
        <p className="text-gray-600 dark:text-gray-400">
          <span className="font-semibold text-gray-900 dark:text-white">{customerName}</span>
          님에게 충전
        </p>

        {/* 결제 금액 */}
        <Input
          label="결제 금액"
          type="number"
          placeholder="0"
          value={actualPayment}
          onChange={(e) => setActualPayment(e.target.value)}
          error={error && !actualPayment ? error : undefined}
        />

        {/* 서비스 금액 */}
        <Input
          label="서비스 금액 (보너스)"
          type="number"
          placeholder="0"
          value={serviceAmount}
          onChange={(e) => setServiceAmount(e.target.value)}
        />

        {/* 합계 표시 */}
        <div className="bg-primary-50 dark:bg-primary-900/20 rounded-button p-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">충전 합계</span>
            <span className="font-bold text-primary-600 dark:text-primary-400">
              {totalAmount.toLocaleString()}원
            </span>
          </div>
        </div>

        {/* 결제 수단 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            결제 수단
          </label>
          <div className="grid grid-cols-3 gap-2">
            {paymentMethods.map(({ value, icon: Icon, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setPaymentMethod(value)}
                className={`flex flex-col items-center justify-center p-3 rounded-button border-2 transition-colors min-h-touch
                  ${paymentMethod === value
                    ? 'border-primary-500 bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300 dark:border-primary-800/50 dark:text-gray-400'
                  }`}
              >
                <Icon className="w-5 h-5 mb-1" />
                <span className="text-sm font-medium">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 비고 */}
        <Input
          label="비고 (선택)"
          type="text"
          placeholder="메모"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        {error && <p className="text-error-500 text-sm">{error}</p>}

        {/* 버튼 */}
        <div className="flex gap-2 pt-2">
          <Button variant="outline" onClick={handleClose} className="flex-1">
            취소
          </Button>
          <Button variant="success" onClick={handleSubmit} isLoading={isLoading} className="flex-1">
            충전하기
          </Button>
        </div>
      </div>
    </Modal>
  );
}
