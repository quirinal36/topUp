import { forwardRef } from 'react';
import { User, Phone } from 'lucide-react';
import { clsx } from 'clsx';
import { Customer } from '../../types';
import Card from '../common/Card';

interface CustomerCardProps {
  customer: Customer;
  onClick: () => void;
  variant?: 'default' | 'pos';
  selected?: boolean;
}

const CustomerCard = forwardRef<HTMLDivElement, CustomerCardProps>(({ customer, onClick, variant = 'default', selected = false }, ref) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR').format(amount) + '원';
  };

  // POS variant: larger, more touch-friendly
  if (variant === 'pos') {
    return (
      <div
        ref={ref}
        onClick={onClick}
        data-testid="customer-item"
        className={clsx(
          'p-4 rounded-xl cursor-pointer transition-all duration-150',
          'active:scale-[0.99]',
          selected
            ? 'bg-primary-50 border-2 border-primary-500 shadow-pos-card-selected dark:bg-primary-900/30 dark:border-primary-400'
            : 'bg-white border-2 border-gray-100 shadow-pos-card hover:border-primary-200 dark:bg-[#2d2420] dark:border-primary-800/30 dark:hover:border-primary-700'
        )}
      >
        {/* 상단: 아바타 + 이름 */}
        <div className="flex items-center gap-3 mb-3">
          <div className={clsx(
            'w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0',
            selected
              ? 'bg-primary-500 dark:bg-primary-600'
              : 'bg-primary-100 dark:bg-primary-900/30'
          )}>
            <User className={clsx(
              'w-6 h-6',
              selected
                ? 'text-white'
                : 'text-primary-600 dark:text-primary-400'
            )} />
          </div>
          <h3 className={clsx(
            'text-lg font-bold truncate flex-1',
            selected
              ? 'text-primary-700 dark:text-primary-300'
              : 'text-gray-900 dark:text-white'
          )}>
            {customer.name}
          </h3>
        </div>

        {/* 중단: 전화번호 */}
        <div className="flex items-center gap-2 mb-3 pl-1">
          <Phone className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
          <span className="text-sm text-gray-500 dark:text-gray-400">
            ****-{customer.phone_suffix}
          </span>
        </div>

        {/* 하단: 잔액 */}
        <div className="pt-3 border-t border-gray-100 dark:border-primary-800/30">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500 dark:text-gray-400">잔액</span>
            <p
              data-testid="customer-balance"
              className={clsx(
                'text-xl font-bold',
                customer.current_balance >= 0
                  ? 'text-primary-600 dark:text-primary-400'
                  : 'text-error-500'
              )}
            >
              {formatCurrency(customer.current_balance)}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Default variant
  return (
    <Card hoverable onClick={onClick} data-testid="customer-item">
      {/* 상단: 아바타 + 이름 */}
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
          <User className="w-5 h-5 text-primary-600 dark:text-primary-400" />
        </div>
        <h3 className="font-semibold text-gray-900 dark:text-white truncate flex-1">
          {customer.name}
        </h3>
      </div>

      {/* 중단: 전화번호 */}
      <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 mb-2 pl-1">
        <Phone className="w-3 h-3 flex-shrink-0" />
        <span>****-{customer.phone_suffix}</span>
      </div>

      {/* 하단: 잔액 */}
      <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500 dark:text-gray-400">잔액</span>
          <p className={`font-bold ${customer.current_balance >= 0 ? 'text-primary-600 dark:text-primary-400' : 'text-error-500'}`}>
            {formatCurrency(customer.current_balance)}
          </p>
        </div>
      </div>
    </Card>
  );
});

CustomerCard.displayName = 'CustomerCard';

export default CustomerCard;
