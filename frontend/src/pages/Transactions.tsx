import { useState } from 'react';
import {
  Search,
  Calendar,
  Filter,
  ArrowUpCircle,
  ArrowDownCircle,
  XCircle,
  MoreVertical,
  Undo2,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import PinVerifyModal from '../components/common/PinVerifyModal';
import { usePinVerify } from '../hooks/usePinVerify';
import { useInfiniteTransactions } from '../hooks/useInfiniteTransactions';
import { cancelTransaction } from '../api/transactions';
import { useToast } from '../contexts/ToastContext';
import { Transaction, TransactionType } from '../types';

export default function Transactions() {
  const toast = useToast();
  const {
    transactions,
    totalCharge,
    totalDeduct,
    total,
    isLoading,
    isLoadingMore,
    hasMore,
    error,
    filters,
    setFilters,
    refresh,
    observerRef,
  } = useInfiniteTransactions();

  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
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
      case 'CARD':
        return '카드';
      case 'CASH':
        return '현금';
      case 'TRANSFER':
        return '이체';
      default:
        return method;
    }
  };

  const handleCancelClick = (transactionId: string) => {
    setOpenMenuId(null);
    withPinVerification(async () => {
      await performCancel(transactionId);
    });
  };

  const performCancel = async (transactionId: string) => {
    setCancellingId(transactionId);
    try {
      await cancelTransaction({ transaction_id: transactionId });
      toast.success('거래가 취소되었습니다');
      refresh();
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { detail?: string } } };
      const errorMsg = errorObj.response?.data?.detail || '거래 취소에 실패했습니다';
      toast.error(errorMsg);
    } finally {
      setCancellingId(null);
    }
  };

  const handleTypeFilter = (type: TransactionType | '') => {
    setFilters({ type });
  };

  return (
    <div className="space-y-4">
      {/* 상단 필터 바 */}
      <Card className="sticky top-0 z-10">
        <div className="space-y-3">
          {/* 검색 */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="고객 이름으로 검색..."
              value={filters.search}
              onChange={(e) => setFilters({ search: e.target.value })}
              className="w-full pl-10 pr-4 py-2.5 rounded-button border border-gray-200 dark:border-primary-800/50 bg-white dark:bg-primary-900/20 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* 날짜 및 유형 필터 */}
          <div className="flex flex-wrap gap-2">
            {/* 날짜 필터 */}
            <div className="flex items-center gap-1 bg-gray-50 dark:bg-primary-900/20 rounded-button px-2 py-1">
              <Calendar className="w-4 h-4 text-gray-500" />
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters({ startDate: e.target.value })}
                className="bg-transparent text-sm border-none focus:outline-none text-gray-700 dark:text-gray-300"
              />
              <span className="text-gray-400">~</span>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters({ endDate: e.target.value })}
                className="bg-transparent text-sm border-none focus:outline-none text-gray-700 dark:text-gray-300"
              />
            </div>

            {/* 유형 필터 */}
            <div className="flex items-center gap-1">
              <Filter className="w-4 h-4 text-gray-500" />
              <select
                value={filters.type}
                onChange={(e) => handleTypeFilter(e.target.value as TransactionType | '')}
                className="bg-gray-50 dark:bg-primary-900/20 text-sm border border-gray-200 dark:border-primary-800/50 rounded-button px-2 py-1.5 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">전체</option>
                <option value="CHARGE">충전</option>
                <option value="DEDUCT">사용</option>
                <option value="CANCEL">취소</option>
              </select>
            </div>

            {/* 새로고침 버튼 */}
            <Button variant="ghost" size="sm" onClick={refresh} className="ml-auto">
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* 합계 카드 */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">충전</p>
          <p className="text-lg font-bold text-success-500">+{formatCurrency(totalCharge)}</p>
        </Card>
        <Card className="text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">사용</p>
          <p className="text-lg font-bold text-primary-500">-{formatCurrency(totalDeduct)}</p>
        </Card>
        <Card className="text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">순 변동</p>
          <p
            className={`text-lg font-bold ${
              totalCharge - totalDeduct >= 0 ? 'text-success-500' : 'text-error-500'
            }`}
          >
            {totalCharge - totalDeduct >= 0 ? '+' : ''}
            {formatCurrency(totalCharge - totalDeduct)}
          </p>
        </Card>
      </div>

      {/* 에러 표시 */}
      {error && (
        <div className="p-3 bg-error-50 dark:bg-error-900/20 text-error-600 dark:text-error-400 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* 거래 목록 */}
      <div>
        <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
          거래 내역 ({total}건)
        </h2>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
          </div>
        ) : transactions.length === 0 ? (
          <Card>
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              {filters.search || filters.type
                ? '검색 결과가 없습니다.'
                : '거래 내역이 없습니다.'}
            </div>
          </Card>
        ) : (
          <div className="space-y-2">
            {transactions.map((transaction: Transaction) => {
              const typeInfo = getTypeInfo(transaction.type);
              const Icon = typeInfo.icon;
              const canCancel = transaction.type !== 'CANCEL';

              return (
                <div
                  key={transaction.id}
                  className="flex items-center gap-3 p-3 bg-white rounded-card shadow-card dark:bg-[#2d2420] dark:shadow-none dark:border dark:border-primary-800/30"
                >
                  <div
                    className={`w-10 h-10 rounded-full ${typeInfo.bgColor} flex items-center justify-center`}
                  >
                    <Icon className={`w-5 h-5 ${typeInfo.color}`} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium ${typeInfo.color}`}>
                        {typeInfo.label}
                      </span>
                      {transaction.customer_name && (
                        <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">
                          {transaction.customer_name}
                        </span>
                      )}
                      {transaction.payment_method && (
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                          {getPaymentMethodLabel(transaction.payment_method)}
                        </span>
                      )}
                    </div>
                    {transaction.note && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
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
                        {typeInfo.prefix}
                        {formatCurrency(transaction.amount)}
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
                          onClick={() =>
                            setOpenMenuId(openMenuId === transaction.id ? null : transaction.id)
                          }
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

            {/* 무한 스크롤 감지 요소 */}
            {hasMore && (
              <div ref={observerRef} className="flex items-center justify-center py-4">
                {isLoadingMore && (
                  <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
                )}
              </div>
            )}

            {!hasMore && transactions.length > 0 && (
              <p className="text-center text-sm text-gray-400 py-4">모든 거래를 불러왔습니다</p>
            )}
          </div>
        )}
      </div>

      {/* PIN 인증 모달 */}
      <PinVerifyModal
        isOpen={isPinModalOpen}
        onClose={closePinModal}
        onVerified={handlePinVerified}
        title="거래 취소 확인"
        description="거래를 취소하려면 PIN을 입력해주세요."
      />
    </div>
  );
}
