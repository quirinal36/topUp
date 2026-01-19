import { ButtonHTMLAttributes, forwardRef } from 'react';
import { clsx } from 'clsx';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'success' | 'error';
  size?: 'sm' | 'md' | 'lg' | 'pos' | 'pos-lg';
  isLoading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading, children, disabled, ...props }, ref) => {
    const baseStyles = 'inline-flex items-center justify-center font-medium rounded-button transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed';

    const variants = {
      primary: 'bg-primary-500 text-white hover:bg-primary-600 focus:ring-primary-500',
      secondary: 'bg-secondary-200 text-primary-800 hover:bg-secondary-300 focus:ring-secondary-500',
      outline: 'border-2 border-primary-500 text-primary-600 bg-transparent hover:bg-primary-50 focus:ring-primary-500',
      ghost: 'text-primary-600 hover:bg-primary-50',
      success: 'bg-success-500 text-white hover:bg-success-600 focus:ring-success-500',
      error: 'bg-error-500 text-white hover:bg-error-600 focus:ring-error-500',
    };

    const sizes = {
      sm: 'min-h-[2rem] min-w-[2rem] px-3 py-1 text-sm',
      md: 'min-h-touch min-w-touch px-4 py-2',
      lg: 'min-h-touch-lg px-6 py-3 text-lg',
      // POS system sizes - large touch targets for tablet
      pos: 'min-h-pos min-w-pos px-6 py-3 text-lg font-semibold rounded-xl shadow-pos-button active:shadow-pos-button-active active:scale-[0.98] transition-all duration-150',
      'pos-lg': 'min-h-pos-lg min-w-pos-lg px-8 py-4 text-xl font-bold rounded-2xl shadow-pos-button active:shadow-pos-button-active active:scale-[0.98] transition-all duration-150',
    };

    return (
      <button
        ref={ref}
        className={clsx(baseStyles, variants[variant], sizes[size], className)}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        ) : null}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;
