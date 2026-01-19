import { clsx } from 'clsx';
import { Delete } from 'lucide-react';

interface NumpadProps {
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
  onSubmit?: () => void;
  className?: string;
}

const Numpad = ({ value, onChange, maxLength = 4, onSubmit: _onSubmit, className }: NumpadProps) => {
  // onSubmit is available for future use (e.g., pressing enter on numpad)
  void _onSubmit;
  const handleDigit = (digit: string) => {
    if (value.length < maxLength) {
      onChange(value + digit);
    }
  };

  const handleBackspace = () => {
    onChange(value.slice(0, -1));
  };

  const handleClear = () => {
    onChange('');
  };

  const buttonClass = clsx(
    'min-h-pos-lg min-w-pos-lg flex items-center justify-center',
    'text-2xl font-semibold rounded-xl',
    'bg-white border border-gray-200 text-gray-800',
    'hover:bg-gray-50 active:bg-gray-100 active:scale-[0.98]',
    'dark:bg-[#3d322c] dark:border-primary-800/50 dark:text-white',
    'dark:hover:bg-[#4d3c34] dark:active:bg-[#5d4c44]',
    'transition-all duration-150 shadow-pos-button',
    'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2'
  );

  const actionButtonClass = clsx(
    buttonClass,
    'bg-gray-100 dark:bg-[#2d2420]'
  );

  return (
    <div className={clsx('grid grid-cols-3 gap-3', className)}>
      {/* Row 1: 1, 2, 3 */}
      {['1', '2', '3'].map((digit) => (
        <button
          key={digit}
          type="button"
          onClick={() => handleDigit(digit)}
          className={buttonClass}
        >
          {digit}
        </button>
      ))}

      {/* Row 2: 4, 5, 6 */}
      {['4', '5', '6'].map((digit) => (
        <button
          key={digit}
          type="button"
          onClick={() => handleDigit(digit)}
          className={buttonClass}
        >
          {digit}
        </button>
      ))}

      {/* Row 3: 7, 8, 9 */}
      {['7', '8', '9'].map((digit) => (
        <button
          key={digit}
          type="button"
          onClick={() => handleDigit(digit)}
          className={buttonClass}
        >
          {digit}
        </button>
      ))}

      {/* Row 4: Clear, 0, Backspace */}
      <button
        type="button"
        onClick={handleClear}
        className={clsx(actionButtonClass, 'text-lg text-gray-500 dark:text-gray-400')}
      >
        C
      </button>
      <button
        type="button"
        onClick={() => handleDigit('0')}
        className={buttonClass}
      >
        0
      </button>
      <button
        type="button"
        onClick={handleBackspace}
        className={actionButtonClass}
      >
        <Delete className="w-6 h-6 text-gray-500 dark:text-gray-400" />
      </button>
    </div>
  );
};

export default Numpad;
