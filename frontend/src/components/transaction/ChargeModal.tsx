import { useState, useEffect } from 'react';
import { CreditCard, Banknote, Building2, Plus, Wallet } from 'lucide-react';
import { clsx } from 'clsx';
import Modal from '../common/Modal';
import Input from '../common/Input';
import Button from '../common/Button';
import QuickAmountSelector, { DEFAULT_CHARGE_AMOUNTS } from '../pos/QuickAmountSelector';
import Numpad from '../pos/Numpad';
import { PaymentMethod } from '../../types';
import { charge } from '../../api/transactions';
import { useToast } from '../../contexts/ToastContext';
import { audioFeedback } from '../../utils/audioFeedback';
import { getErrorMessage, isNetworkError, isServerError } from '../../utils/errorHandler';

interface ChargeModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerId: string;
  customerName: string;
  currentBalance?: number;
  onSuccess: () => void;
}

export default function ChargeModal({
  isOpen,
  onClose,
  customerId,
  customerName,
  currentBalance = 0,
  onSuccess,
}: ChargeModalProps) {
  const toast = useToast();
  const [actualPayment, setActualPayment] = useState('');
  const [serviceAmount, setServiceAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CARD');
  const [note, setNote] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  // Initialize audio on modal open
  useEffect(() => {
    if (isOpen) {
      audioFeedback.init();
    }
  }, [isOpen]);

  const paymentMethods = [
    { value: 'CARD' as const, icon: CreditCard, label: '카드' },
    { value: 'CASH' as const, icon: Banknote, label: '현금' },
    { value: 'TRANSFER' as const, icon: Building2, label: '이체' },
  ];

  const totalAmount = (parseInt(actualPayment) || 0) + (parseInt(serviceAmount) || 0);
  const newBalance = currentBalance + totalAmount;

  // 빠른 금액 선택
  const handleQuickAmountSelect = (selectedAmount: number) => {
    setActualPayment(selectedAmount.toString());
    setShowCustomInput(false);
    audioFeedback.playSelect();
  };

  // 직접 입력 모드
  const handleCustomInput = () => {
    setShowCustomInput(true);
    setActualPayment('');
  };

  // 넘패드 입력
  const handleNumpadChange = (value: string) => {
    setActualPayment(value);
  };

  // 결제 수단 선택
  const handlePaymentMethodSelect = (method: PaymentMethod) => {
    setPaymentMethod(method);
    audioFeedback.playTap();
  };

  const handleSubmit = async () => {
    if (!actualPayment || parseInt(actualPayment) <= 0) {
      setError('결제 금액을 입력해주세요');
      audioFeedback.playError();
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
      audioFeedback.playSuccess();
      toast.success(`${customerName}님에게 ${totalAmount.toLocaleString()}원이 충전되었습니다`);
      onSuccess();
      handleClose();
    } catch (err) {
      audioFeedback.playError();
      // 네트워크/서버 에러는 전역 핸들러가 토스트를 표시하므로 중복 방지
      if (!isNetworkError(err) && !isServerError(err)) {
        toast.error(getErrorMessage(err));
      }
      setError(getErrorMessage(err));
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
    setShowCustomInput(false);
    onClose();
  };

  const actualPaymentNum = parseInt(actualPayment) || 0;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="충전" size="lg">
      <div className="space-y-5">
        {/* 고객 정보 헤더 - POS 스타일 */}
        <div className="flex justify-between items-center p-4 bg-gray-50 dark:bg-primary-900/20 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-success-100 dark:bg-success-800/50 flex items-center justify-center">
              <Wallet className="w-6 h-6 text-success-600 dark:text-success-400" />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{customerName}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">고객</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500 dark:text-gray-400">현재 잔액</p>
            <p className="text-2xl font-bold text-primary-600 dark:text-primary-400">
              {currentBalance.toLocaleString()}원
            </p>
          </div>
        </div>

        {/* 빠른 금액 선택 - POS 스타일 */}
        {!showCustomInput && (
          <div>
            <label className="block text-base font-semibold text-gray-700 dark:text-gray-300 mb-3">
              충전 금액 선택
            </label>
            <QuickAmountSelector
              amounts={DEFAULT_CHARGE_AMOUNTS}
              selectedAmount={actualPaymentNum || null}
              onSelect={handleQuickAmountSelect}
              onCustom={handleCustomInput}
            />
          </div>
        )}

        {/* 직접 입력 모드 - 넘패드 */}
        {showCustomInput && (
          <div>
            <div className="flex justify-between items-center mb-3">
              <label className="text-base font-semibold text-gray-700 dark:text-gray-300">
                직접 입력
              </label>
              <button
                type="button"
                onClick={() => setShowCustomInput(false)}
                className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
              >
                빠른 선택으로 돌아가기
              </button>
            </div>
            <div className="flex flex-col tablet:flex-row gap-4">
              <div className="flex-1">
                <Input
                  inputSize="pos"
                  type="text"
                  placeholder="금액을 입력하세요"
                  value={actualPayment ? `${parseInt(actualPayment).toLocaleString()}원` : ''}
                  readOnly
                  className="text-center text-2xl font-bold"
                />
              </div>
              <div className="tablet:w-64">
                <Numpad
                  value={actualPayment}
                  onChange={handleNumpadChange}
                  maxLength={7}
                />
              </div>
            </div>
          </div>
        )}

        {/* 선택된 금액 표시 (빠른 선택 모드) */}
        {!showCustomInput && actualPaymentNum > 0 && (
          <div className="text-center py-2">
            <span className="text-gray-500 dark:text-gray-400">선택 금액: </span>
            <span className="text-2xl font-bold text-gray-900 dark:text-white">
              {actualPaymentNum.toLocaleString()}원
            </span>
          </div>
        )}

        {/* 서비스 금액 */}
        <Input
          inputSize="pos"
          label="서비스 금액 (보너스)"
          type="number"
          placeholder="0"
          value={serviceAmount}
          onChange={(e) => setServiceAmount(e.target.value)}
        />

        {/* 결제 수단 - POS 스타일 */}
        <div>
          <label className="block text-base font-semibold text-gray-700 dark:text-gray-300 mb-3">
            결제 수단
          </label>
          <div className="grid grid-cols-3 gap-3">
            {paymentMethods.map(({ value, icon: Icon, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => handlePaymentMethodSelect(value)}
                className={clsx(
                  'flex flex-col items-center justify-center min-h-pos rounded-xl border-2 transition-all duration-150',
                  'active:scale-[0.98]',
                  paymentMethod === value
                    ? 'border-primary-500 bg-primary-50 text-primary-600 shadow-pos-card-selected dark:bg-primary-900/30 dark:text-primary-400 dark:border-primary-400'
                    : 'border-gray-200 text-gray-600 hover:border-primary-200 dark:border-primary-800/50 dark:text-gray-400 dark:hover:border-primary-700'
                )}
              >
                <Icon className="w-6 h-6 mb-1" />
                <span className="text-base font-semibold">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 비고 */}
        <Input
          inputSize="pos"
          label="비고 (선택)"
          type="text"
          placeholder="메모"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        {/* 충전 후 잔액 미리보기 - POS 스타일 */}
        {totalAmount > 0 && (
          <div className="rounded-xl p-4 border-2 bg-success-50 border-success-200 dark:bg-success-900/20 dark:border-success-800">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">충전 후 잔액</p>
                <p className="text-2xl font-bold text-success-600 dark:text-success-400">
                  {newBalance.toLocaleString()}원
                </p>
              </div>
              <div className="text-right flex flex-col items-end">
                <Plus className="w-8 h-8 text-success-400" />
                <span className="text-lg font-bold text-success-600 dark:text-success-400">
                  +{totalAmount.toLocaleString()}원
                </span>
              </div>
            </div>
          </div>
        )}

        {error && <p className="text-error-500 text-base font-medium">{error}</p>}

        {/* 버튼 - POS 스타일 */}
        <div className="flex gap-3 pt-2">
          <Button
            variant="outline"
            size="pos"
            onClick={handleClose}
            className="flex-1"
          >
            취소
          </Button>
          <Button
            variant="success"
            size="pos-lg"
            onClick={handleSubmit}
            isLoading={isLoading}
            disabled={!totalAmount}
            className="flex-[2]"
          >
            충전하기 ({totalAmount.toLocaleString()}원)
          </Button>
        </div>
      </div>
    </Modal>
  );
}
