import { ArrowUpCircle, ArrowDownCircle, XCircle } from 'lucide-react';
import { Transaction } from '../../types';

interface TransactionListProps {
  transactions: Transaction[];
  showCustomer?: boolean;
}

export default function TransactionList({ transactions, showCustomer: _showCustomer = false }: TransactionListProps) {
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

  if (transactions.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        거래 내역이 없습니다.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {transactions.map((transaction) => {
        const typeInfo = getTypeInfo(transaction.type);
        const Icon = typeInfo.icon;

        return (
          <div
            key={transaction.id}
            className="flex items-center gap-3 p-3 bg-white rounded-card shadow-card dark:bg-[#2d2420] dark:shadow-none dark:border dark:border-primary-800/30"
          >
            {/* 아이콘 */}
            <div className={`w-10 h-10 rounded-full ${typeInfo.bgColor} flex items-center justify-center`}>
              <Icon className={`w-5 h-5 ${typeInfo.color}`} />
            </div>

            {/* 정보 */}
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
                <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                  {transaction.note}
                </p>
              )}
              <p className="text-xs text-gray-400 dark:text-gray-500">
                {formatDate(transaction.created_at)}
              </p>
            </div>

            {/* 금액 */}
            <div className="text-right">
              <p className={`font-bold ${typeInfo.color}`}>
                {typeInfo.prefix}{formatCurrency(transaction.amount)}
              </p>
              {transaction.service_amount && transaction.service_amount > 0 && (
                <p className="text-xs text-gray-400">
                  (서비스 {formatCurrency(transaction.service_amount)})
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
