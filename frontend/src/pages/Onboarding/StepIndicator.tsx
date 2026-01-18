import { Check } from 'lucide-react';
import clsx from 'clsx';

interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
}

const stepLabels = ['상점 정보', '메뉴 등록', '고객 등록'];

export default function StepIndicator({
  currentStep,
  totalSteps,
}: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-center mb-8">
      {Array.from({ length: totalSteps }, (_, i) => {
        const step = i + 1;
        const isCompleted = step < currentStep;
        const isCurrent = step === currentStep;

        return (
          <div key={step} className="flex items-center">
            {/* Step circle */}
            <div className="flex flex-col items-center">
              <div
                className={clsx(
                  'w-10 h-10 rounded-full flex items-center justify-center font-medium text-sm transition-all',
                  isCompleted &&
                    'bg-primary-500 text-white',
                  isCurrent &&
                    'bg-primary-500 text-white ring-4 ring-primary-200',
                  !isCompleted &&
                    !isCurrent &&
                    'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                )}
              >
                {isCompleted ? <Check size={20} /> : step}
              </div>
              <span
                className={clsx(
                  'mt-2 text-xs font-medium',
                  isCurrent
                    ? 'text-primary-600 dark:text-primary-400'
                    : 'text-gray-500 dark:text-gray-400'
                )}
              >
                {stepLabels[i]}
              </span>
            </div>

            {/* Connector line */}
            {i < totalSteps - 1 && (
              <div
                className={clsx(
                  'w-12 sm:w-20 h-1 mx-2 mb-6',
                  step < currentStep
                    ? 'bg-primary-500'
                    : 'bg-gray-200 dark:bg-gray-700'
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
