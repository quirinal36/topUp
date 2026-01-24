import { useState, useEffect } from 'react';
import { Coffee, Minus } from 'lucide-react';
import { clsx } from 'clsx';
import Modal from '../common/Modal';
import Input from '../common/Input';
import Button from '../common/Button';
import QuickAmountSelector from '../pos/QuickAmountSelector';
import Numpad from '../pos/Numpad';
import { deduct } from '../../api/transactions';
import { getMenus } from '../../api/menus';
import { useToast } from '../../contexts/ToastContext';
import { audioFeedback } from '../../utils/audioFeedback';
import { getErrorMessage, isNetworkError, isServerError } from '../../utils/errorHandler';
import { Menu } from '../../types';

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
  const toast = useToast();
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [menus, setMenus] = useState<Menu[]>([]);
  const [selectedMenuId, setSelectedMenuId] = useState<string>('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  // 메뉴 목록 불러오기
  useEffect(() => {
    if (isOpen) {
      getMenus(false).then((response) => {
        setMenus(response.menus);
      }).catch(() => {
        setMenus([]);
      });
      // Initialize audio on modal open
      audioFeedback.init();
    }
  }, [isOpen]);

  // 메뉴 기반 빠른 금액 또는 기본값
  const quickAmounts = menus.length > 0
    ? menus.slice(0, 8).map(m => m.price)
    : [4500, 5000, 5500, 6000, 6500, 7000, 7500, 8000];

  // 메뉴 선택 시 금액 및 노트 자동 설정
  const handleMenuSelect = (menuId: string) => {
    setSelectedMenuId(menuId);
    if (menuId) {
      const selectedMenu = menus.find((m) => m.id === menuId);
      if (selectedMenu) {
        setAmount(selectedMenu.price.toString());
        setNote(selectedMenu.name);
        audioFeedback.playSelect();
      }
    } else {
      setAmount('');
      setNote('');
    }
  };

  // 빠른 금액 선택
  const handleQuickAmountSelect = (selectedAmount: number) => {
    setAmount(selectedAmount.toString());
    setShowCustomInput(false);
    // 메뉴와 매칭되면 노트 자동 설정
    const matchingMenu = menus.find(m => m.price === selectedAmount);
    if (matchingMenu) {
      setNote(matchingMenu.name);
      setSelectedMenuId(matchingMenu.id);
    } else {
      setNote('');
      setSelectedMenuId('');
    }
    audioFeedback.playSelect();
  };

  // 직접 입력 모드
  const handleCustomInput = () => {
    setShowCustomInput(true);
    setAmount('');
    setSelectedMenuId('');
    setNote('');
  };

  // 넘패드 입력
  const handleNumpadChange = (value: string) => {
    setAmount(value);
  };

  const handleSubmit = async () => {
    const amountNum = parseInt(amount);
    if (!amount || amountNum <= 0) {
      setError('사용 금액을 입력해주세요');
      audioFeedback.playError();
      return;
    }

    if (amountNum > currentBalance) {
      setError(`잔액이 부족합니다. (현재 잔액: ${currentBalance.toLocaleString()}원)`);
      audioFeedback.playError();
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
      audioFeedback.playSuccess();
      toast.success(`${customerName}님의 ${amountNum.toLocaleString()}원이 사용되었습니다`);
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
    setAmount('');
    setNote('');
    setError('');
    setSelectedMenuId('');
    setShowCustomInput(false);
    onClose();
  };

  const amountNum = parseInt(amount) || 0;
  const newBalance = currentBalance - amountNum;
  const isInsufficientBalance = amountNum > currentBalance;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="사용 (차감)" size="lg">
      <div className="space-y-5">
        {/* 고객 정보 헤더 - POS 스타일 */}
        <div className="flex justify-between items-center p-4 bg-gray-50 dark:bg-primary-900/20 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary-100 dark:bg-primary-800/50 flex items-center justify-center">
              <Coffee className="w-6 h-6 text-primary-600 dark:text-primary-400" />
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

        {/* 메뉴 선택 (드롭다운) - 메뉴가 있을 때만 표시 */}
        {menus.length > 0 && (
          <div>
            <label className="block text-base font-semibold text-gray-700 dark:text-gray-300 mb-2">
              메뉴 선택
            </label>
            <select
              value={selectedMenuId}
              onChange={(e) => handleMenuSelect(e.target.value)}
              className="w-full min-h-pos px-4 py-3 border border-gray-200 rounded-xl text-lg bg-white dark:bg-[#2d2420] dark:border-primary-800/50 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="">직접 입력</option>
              {menus.map((menu) => (
                <option key={menu.id} value={menu.id}>
                  {menu.name} - {menu.price.toLocaleString()}원
                </option>
              ))}
            </select>
          </div>
        )}

        {/* 빠른 금액 선택 - POS 스타일 */}
        {!selectedMenuId && !showCustomInput && (
          <div>
            <label className="block text-base font-semibold text-gray-700 dark:text-gray-300 mb-3">
              빠른 선택
            </label>
            <QuickAmountSelector
              amounts={quickAmounts}
              selectedAmount={amountNum || null}
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
                  value={amount ? `${parseInt(amount).toLocaleString()}원` : ''}
                  readOnly
                  className="text-center text-2xl font-bold"
                />
              </div>
              <div className="tablet:w-64">
                <Numpad
                  value={amount}
                  onChange={handleNumpadChange}
                  maxLength={7}
                />
              </div>
            </div>
          </div>
        )}

        {/* 선택된 금액 표시 (빠른 선택 모드) */}
        {!showCustomInput && amountNum > 0 && (
          <div className="text-center py-2">
            <span className="text-gray-500 dark:text-gray-400">선택 금액: </span>
            <span className="text-2xl font-bold text-gray-900 dark:text-white">
              {amountNum.toLocaleString()}원
            </span>
          </div>
        )}

        {/* 비고 (주문 메뉴) */}
        <Input
          inputSize="pos"
          label="주문 메뉴 (선택)"
          type="text"
          placeholder="아메리카노, 카페라떼"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={!!selectedMenuId}
        />

        {/* 차감 후 잔액 미리보기 - POS 스타일 */}
        {amountNum > 0 && (
          <div className={clsx(
            'rounded-xl p-4 border-2',
            isInsufficientBalance
              ? 'bg-error-50 border-error-200 dark:bg-error-900/20 dark:border-error-800'
              : 'bg-success-50 border-success-200 dark:bg-success-900/20 dark:border-success-800'
          )}>
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">차감 후 잔액</p>
                <p className={clsx(
                  'text-2xl font-bold',
                  isInsufficientBalance
                    ? 'text-error-600 dark:text-error-400'
                    : 'text-success-600 dark:text-success-400'
                )}>
                  {newBalance.toLocaleString()}원
                </p>
              </div>
              <div className="text-right">
                <Minus className={clsx(
                  'w-8 h-8',
                  isInsufficientBalance
                    ? 'text-error-400'
                    : 'text-success-400'
                )} />
              </div>
            </div>
            {isInsufficientBalance && (
              <p className="text-sm text-error-600 dark:text-error-400 mt-2">
                잔액이 부족합니다
              </p>
            )}
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
            variant="error"
            size="pos-lg"
            onClick={handleSubmit}
            isLoading={isLoading}
            disabled={!amountNum || isInsufficientBalance}
            className="flex-[2]"
          >
            차감하기 ({amountNum.toLocaleString()}원)
          </Button>
        </div>
      </div>
    </Modal>
  );
}
