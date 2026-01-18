import { useState } from 'react';
import { ArrowUpCircle, ArrowDownCircle, XCircle, MoreVertical, Undo2, Coffee } from 'lucide-react';
import { Transaction } from '../../types';
import { cancelTransaction } from '../../api/transactions';
import Button from '../common/Button';
import PinVerifyModal from '../common/PinVerifyModal';
import { usePinVerify } from '../../hooks/usePinVerify';
import { useToast } from '../../contexts/ToastContext';

interface TransactionListProps {
  transactions: Transaction[];
  showCustomer?: boolean;
  onTransactionCancelled?: () => void;
}

export default function TransactionList({
  transactions,
  showCustomer: _showCustomer = false,
  onTransactionCancelled,
}: TransactionListProps) {
  const toast = useToast();
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { isPinModalOpen, closePinModal, withPinVerification, handlePinVerified } = usePinVerify();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR').format(amount) + '원';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTypeInfo = (type: string) => {
    switch (type) {
      case 'CHARGE':
        return {
          icon: ArrowUpCircle,
          color: 'text-success-500',
          bgColor: 'bg-success-50 dark:bg-success-900/20',
          label: '충전',
          prefix: '+',
        };
      case 'DEDUCT':
        return {
          icon: ArrowDownCircle,
          color: 'text-primary-500',
          bgColor: 'bg-primary-50 dark:bg-primary-900/20',
          label: '사용',
          prefix: '-',
        };
      case 'CANCEL':
        return {
          icon: XCircle,
          color: 'text-error-500',
          bgColor: 'bg-error-50 dark:bg-error-900/20',
          label: '취소',
          prefix: '',
        };
      default:
        return {
          icon: ArrowDownCircle,
          color: 'text-gray-500',
          bgColor: 'bg-gray-50',
          label: type,
          prefix: '',
        };
    }
  };

  const getPaymentMethodLabel = (method?: string) => {
    switch (method) {
      case 'CARD': return '카드';
      case 'CASH': return '현금';
      case 'TRANSFER': return '이체';
      default: return method;
    }
  };

  const handleCancelClick = (transactionId: string) => {
    setOpenMenuId(null);
    setError(null);
    withPinVerification(async () => {
      await performCancel(transactionId);
    });
  };

  const performCancel = async (transactionId: string) => {
    setCancellingId(transactionId);
    try {
      await cancelTransaction({ transaction_id: transactionId });
      toast.success('거래가 취소되었습니다');
      onTransactionCancelled?.();
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { detail?: string } } };
      const errorMsg = errorObj.response?.data?.detail || '거래 취소에 실패했습니다';
      toast.error(errorMsg);
      setError(errorMsg);
    } finally {
      setCancellingId(null);
    }
  };

  if (transactions.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        거래 내역이 없습니다.
      </div>
    );
  }

  return (
    <>
      {error && (
        <div className="mb-4 p-3 bg-error-50 dark:bg-error-900/20 text-error-600 dark:text-error-400 rounded-lg text-sm">
          {error}
        </div>
      )}
      
      <div className="space-y-2">
        {transactions.map((transaction) => {
          const typeInfo = getTypeInfo(transaction.type);
          const Icon = typeInfo.icon;
          const canCancel = transaction.type !== 'CANCEL';

          return (
            <div
              key={transaction.id}
              className="flex items-center gap-3 p-3 bg-white rounded-card shadow-card dark:bg-[#2d2420] dark:shadow-none dark:border dark:border-primary-800/30"
            >
              <div className={`w-10 h-10 rounded-full ${typeInfo.bgColor} flex items-center justify-center`}>
                <Icon className={`w-5 h-5 ${typeInfo.color}`} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${typeInfo.color}`}>
                    {typeInfo.label}
                  </span>
                  {transaction.payment_method && (
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      {getPaymentMethodLabel(transaction.payment_method)}
                    </span>
                  )}
                </div>
                {transaction.note && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 truncate flex items-center gap-1">
                    {transaction.type === 'DEDUCT' && <Coffee className="w-3 h-3 flex-shrink-0" />}
                    {transaction.note}
                  </p>
                )}
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  {formatDate(transaction.created_at)}
                </p>
              </div>

              <div className="text-right flex items-center gap-2">
                <div>
                  <p className={`font-bold ${typeInfo.color}`}>
                    {typeInfo.prefix}{formatCurrency(transaction.amount)}
                  </p>
                  {transaction.service_amount && transaction.service_amount > 0 && (
                    <p className="text-xs text-gray-400">
                      (서비스 {formatCurrency(transaction.service_amount)})
                    </p>
                  )}
                </div>

                {canCancel && (
                  <div className="relative">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setOpenMenuId(openMenuId === transaction.id ? null : transaction.id)}
                      disabled={cancellingId === transaction.id}
                    >
                      <MoreVertical className="w-4 h-4" />
                    </Button>

                    {openMenuId === transaction.id && (
                      <>
                        <div 
                          className="fixed inset-0 z-10" 
                          onClick={() => setOpenMenuId(null)} 
                        />
                        <div className="absolute right-0 top-full mt-1 z-20 bg-white dark:bg-[#3d322c] rounded-lg shadow-lg border border-gray-200 dark:border-primary-800/30 py-1 min-w-[120px]">
                          <button
                            onClick={() => handleCancelClick(transaction.id)}
                            className="w-full px-4 py-2 text-left text-sm text-error-500 hover:bg-error-50 dark:hover:bg-error-900/20 flex items-center gap-2"
                          >
                            <Undo2 className="w-4 h-4" />
                            취소하기
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <PinVerifyModal
        isOpen={isPinModalOpen}
        onClose={closePinModal}
        onVerified={handlePinVerified}
        title="거래 취소 확인"
        description="거래를 취소하려면 PIN을 입력해주세요."
      />
    </>
  );
}
