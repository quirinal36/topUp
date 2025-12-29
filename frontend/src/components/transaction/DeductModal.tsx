import { useState } from 'react';
import Modal from '../common/Modal';
import Input from '../common/Input';
import Button from '../common/Button';
import { deduct } from '../../api/transactions';

interface DeductModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerId: string;
  customerName: string;
  currentBalance: number;
  onSuccess: () => void;
}

export default function DeductModal({
  isOpen,
  onClose,
  customerId,
  customerName,
  currentBalance,
  onSuccess,
}: DeductModalProps) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // 빠른 금액 선택
  const quickAmounts = [3000, 5000, 10000, 15000, 20000];

  const handleSubmit = async () => {
    const amountNum = parseInt(amount);
    if (!amount || amountNum <= 0) {
      setError('사용 금액을 입력해주세요');
      return;
    }

    if (amountNum > currentBalance) {
      setError(`잔액이 부족합니다. (현재 잔액: ${currentBalance.toLocaleString()}원)`);
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await deduct({
        customer_id: customerId,
        amount: amountNum,
        note: note || undefined,
      });
      onSuccess();
      handleClose();
    } catch (err: any) {
      setError(err.response?.data?.detail || '차감에 실패했습니다');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setAmount('');
    setNote('');
    setError('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="사용 (차감)" size="md">
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <p className="text-gray-600 dark:text-gray-400">
            <span className="font-semibold text-gray-900 dark:text-white">{customerName}</span>
            님
          </p>
          <p className="text-sm">
            현재 잔액:{' '}
            <span className="font-bold text-primary-600 dark:text-primary-400">
              {currentBalance.toLocaleString()}원
            </span>
          </p>
        </div>

        {/* 빠른 금액 선택 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            빠른 선택
          </label>
          <div className="flex flex-wrap gap-2">
            {quickAmounts.map((quickAmount) => (
              <button
                key={quickAmount}
                type="button"
                onClick={() => setAmount(quickAmount.toString())}
                className={`px-3 py-2 rounded-button border text-sm font-medium transition-colors min-h-touch
                  ${parseInt(amount) === quickAmount
                    ? 'border-primary-500 bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300 dark:border-primary-800/50 dark:text-gray-400'
                  }`}
              >
                {quickAmount.toLocaleString()}원
              </button>
            ))}
          </div>
        </div>

        {/* 사용 금액 */}
        <Input
          label="사용 금액"
          type="number"
          placeholder="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />

        {/* 비고 (주문 메뉴) */}
        <Input
          label="주문 메뉴 (선택)"
          type="text"
          placeholder="아메리카노, 카페라떼"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        {/* 차감 후 잔액 미리보기 */}
        {amount && parseInt(amount) > 0 && (
          <div className="bg-gray-50 dark:bg-primary-900/10 rounded-button p-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">차감 후 잔액</span>
              <span className={`font-bold ${currentBalance - parseInt(amount) < 0 ? 'text-error-500' : 'text-gray-900 dark:text-white'}`}>
                {(currentBalance - parseInt(amount)).toLocaleString()}원
              </span>
            </div>
          </div>
        )}

        {error && <p className="text-error-500 text-sm">{error}</p>}

        {/* 버튼 */}
        <div className="flex gap-2 pt-2">
          <Button variant="outline" onClick={handleClose} className="flex-1">
            취소
          </Button>
          <Button onClick={handleSubmit} isLoading={isLoading} className="flex-1">
            사용하기
          </Button>
        </div>
      </div>
    </Modal>
  );
}
