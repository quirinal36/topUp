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
          'min-h-pos-xl p-4 rounded-xl cursor-pointer transition-all duration-150',
          'flex items-center justify-between',
          'active:scale-[0.99]',
          selected
            ? 'bg-primary-50 border-2 border-primary-500 shadow-pos-card-selected dark:bg-primary-900/30 dark:border-primary-400'
            : 'bg-white border-2 border-gray-100 shadow-pos-card hover:border-primary-200 dark:bg-[#2d2420] dark:border-primary-800/30 dark:hover:border-primary-700'
        )}
      >
        <div className="flex items-center gap-4">
          <div className={clsx(
            'w-14 h-14 rounded-full flex items-center justify-center',
            selected
              ? 'bg-primary-500 dark:bg-primary-600'
              : 'bg-primary-100 dark:bg-primary-900/30'
          )}>
            <User className={clsx(
              'w-7 h-7',
              selected
                ? 'text-white'
                : 'text-primary-600 dark:text-primary-400'
            )} />
          </div>
          <div>
            <h3 className={clsx(
              'text-xl font-bold',
              selected
                ? 'text-primary-700 dark:text-primary-300'
                : 'text-gray-900 dark:text-white'
            )}>
              {customer.name}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <Phone className="w-4 h-4 text-gray-400 dark:text-gray-500" />
              <span className="text-base text-gray-500 dark:text-gray-400">
                ***-****-<span className="font-bold text-primary-600 dark:text-primary-400">{customer.phone_suffix}</span>
              </span>
            </div>
          </div>
        </div>

        <div className="text-right">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">잔액</p>
          <p
            data-testid="customer-balance"
            className={clsx(
              'text-2xl font-bold',
              customer.current_balance >= 0
                ? 'text-primary-600 dark:text-primary-400'
                : 'text-error-500'
            )}
          >
            {formatCurrency(customer.current_balance)}
          </p>
        </div>
      </div>
    );
  }

  // Default variant
  return (
    <Card hoverable onClick={onClick} data-testid="customer-item">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
            <User className="w-6 h-6 text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">
              {customer.name}
            </h3>
            <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
              <Phone className="w-3 h-3" />
              <span>***-****-{customer.phone_suffix}</span>
            </div>
          </div>
        </div>

        <div className="text-right">
          <p className="text-sm text-gray-500 dark:text-gray-400">잔액</p>
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
