import { InputHTMLAttributes, forwardRef } from 'react';
import { clsx } from 'clsx';
import { X } from 'lucide-react';

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  error?: string;
  inputSize?: 'md' | 'pos';
  onClear?: () => void;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, disabled, inputSize = 'md', onClear, value, ...props }, ref) => {
    const inputSizeStyles = {
      md: 'min-h-touch px-4 py-2 text-base',
      pos: 'min-h-pos px-5 py-3 text-lg font-medium rounded-xl',
    };

    const labelStyles = {
      md: 'text-sm',
      pos: 'text-base font-semibold',
    };

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={id} className={clsx('block font-medium text-gray-700 dark:text-gray-300 mb-1', labelStyles[inputSize])}>
            {label}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            id={id}
            disabled={disabled}
            value={value}
            className={clsx(
              'w-full rounded-button border bg-white text-gray-900 placeholder-gray-400',
              'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent',
              'dark:bg-[#3d322c] dark:border-primary-800/50 dark:text-white dark:placeholder-gray-500',
              inputSizeStyles[inputSize],
              error ? 'border-error-500' : 'border-gray-300',
              disabled && 'bg-gray-100 dark:bg-[#2d2420] cursor-not-allowed opacity-70',
              onClear && value && 'pr-12',
              className
            )}
            {...props}
          />
          {onClear && value && (
            <button
              type="button"
              onClick={onClear}
              className={clsx(
                'absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full',
                'text-gray-400 hover:text-gray-600 hover:bg-gray-100',
                'dark:hover:text-gray-300 dark:hover:bg-gray-700',
                'transition-colors duration-150',
                inputSize === 'pos' && 'p-2.5'
              )}
            >
              <X className={inputSize === 'pos' ? 'w-5 h-5' : 'w-4 h-4'} />
            </button>
          )}
        </div>
        {error && (
          <p className={clsx('mt-1 text-error-500', inputSize === 'pos' ? 'text-base' : 'text-sm')}>{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;
