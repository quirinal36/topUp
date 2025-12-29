import { User, Phone } from 'lucide-react';
import { Customer } from '../../types';
import Card from '../common/Card';

interface CustomerCardProps {
  customer: Customer;
  onClick: () => void;
}

export default function CustomerCard({ customer, onClick }: CustomerCardProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR').format(amount) + '원';
  };

  return (
    <Card hoverable onClick={onClick}>
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
}
