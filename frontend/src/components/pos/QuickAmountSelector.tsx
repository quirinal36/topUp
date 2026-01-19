import { clsx } from 'clsx';
import { PenLine } from 'lucide-react';

interface QuickAmountSelectorProps {
  amounts: number[];
  selectedAmount: number | null;
  onSelect: (amount: number) => void;
  onCustom: () => void;
  currency?: string;
  className?: string;
}

const formatAmount = (amount: number, currency: string) => {
  return `${amount.toLocaleString()}${currency}`;
};

const QuickAmountSelector = ({
  amounts,
  selectedAmount,
  onSelect,
  onCustom,
  currency = '원',
  className,
}: QuickAmountSelectorProps) => {
  const buttonBaseClass = clsx(
    'min-h-pos flex items-center justify-center',
    'text-lg font-semibold rounded-xl',
    'transition-all duration-150',
    'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
    'active:scale-[0.98]'
  );

  const unselectedClass = clsx(
    buttonBaseClass,
    'bg-white border-2 border-gray-200 text-gray-700',
    'hover:border-primary-300 hover:bg-primary-50',
    'dark:bg-[#3d322c] dark:border-primary-800/50 dark:text-white',
    'dark:hover:border-primary-600 dark:hover:bg-[#4d3c34]'
  );

  const selectedClass = clsx(
    buttonBaseClass,
    'bg-primary-500 border-2 border-primary-500 text-white',
    'shadow-pos-card-selected',
    'dark:bg-primary-600 dark:border-primary-600'
  );

  const customClass = clsx(
    buttonBaseClass,
    'bg-gray-100 border-2 border-dashed border-gray-300 text-gray-600',
    'hover:border-gray-400 hover:bg-gray-50',
    'dark:bg-[#2d2420] dark:border-primary-800/50 dark:text-gray-300',
    'dark:hover:border-primary-700 dark:hover:bg-[#3d322c]'
  );

  return (
    <div className={clsx('grid grid-cols-3 gap-3', className)}>
      {amounts.map((amount) => (
        <button
          key={amount}
          type="button"
          onClick={() => onSelect(amount)}
          className={selectedAmount === amount ? selectedClass : unselectedClass}
        >
          {formatAmount(amount, currency)}
        </button>
      ))}
      <button
        type="button"
        onClick={onCustom}
        className={customClass}
      >
        <PenLine className="w-5 h-5 mr-2" />
        직접입력
      </button>
    </div>
  );
};

export default QuickAmountSelector;

// Default amounts for different use cases
export const DEFAULT_DEDUCT_AMOUNTS = [4500, 5000, 5500, 6000, 6500, 7000, 7500, 8000];
export const DEFAULT_CHARGE_AMOUNTS = [10000, 30000, 50000, 100000];
