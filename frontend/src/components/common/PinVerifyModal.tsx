import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { Lock, AlertCircle } from 'lucide-react';
import { clsx } from 'clsx';
import Modal from './Modal';
import Button from './Button';
import { verifyPin } from '../../api/auth';

interface PinVerifyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVerified: () => void;
  title?: string;
  description?: string;
}

export default function PinVerifyModal({
  isOpen,
  onClose,
  onVerified,
  title = 'PIN 인증',
  description = '보안을 위해 4자리 PIN을 입력해주세요.',
}: PinVerifyModalProps) {
  const [pin, setPin] = useState(['', '', '', '']);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);
  const [lockedUntil, setLockedUntil] = useState<string | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (isOpen) {
      setPin(['', '', '', '']);
      setError(null);
      setRemainingAttempts(null);
      setLockedUntil(null);
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!lockedUntil) return;

    const checkLock = () => {
      const lockTime = new Date(lockedUntil).getTime();
      const now = Date.now();
      if (now >= lockTime) {
        setLockedUntil(null);
        setError(null);
        setRemainingAttempts(null);
      }
    };

    const interval = setInterval(checkLock, 1000);
    return () => clearInterval(interval);
  }, [lockedUntil]);

  const handleInputChange = (index: number, value: string) => {
    if (value && !/^\d$/.test(value)) return;

    const newPin = [...pin];
    newPin[index] = value;
    setPin(newPin);
    setError(null);

    if (value && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }

    if (value && index === 3 && newPin.every(digit => digit !== '')) {
      handleVerify(newPin.join(''));
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').slice(0, 4);
    if (!/^\d+$/.test(pastedData)) return;

    const newPin = [...pin];
    for (let i = 0; i < pastedData.length && i < 4; i++) {
      newPin[i] = pastedData[i];
    }
    setPin(newPin);

    if (pastedData.length === 4) {
      handleVerify(pastedData);
    } else {
      inputRefs.current[pastedData.length]?.focus();
    }
  };

  const handleVerify = async (pinCode: string) => {
    if (lockedUntil) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await verifyPin(pinCode);

      if (response.verified) {
        onVerified();
        onClose();
      } else {
        setRemainingAttempts(response.remaining_attempts ?? null);
        if (response.locked_until) {
          setLockedUntil(response.locked_until);
          setError('5회 실패로 1분간 잠금되었습니다.');
        } else {
          setError(`PIN이 일치하지 않습니다. (${response.remaining_attempts}회 남음)`);
        }
        setPin(['', '', '', '']);
        inputRefs.current[0]?.focus();
      }
    } catch {
      setError('PIN 검증 중 오류가 발생했습니다.');
      setPin(['', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  const getLockedRemainingTime = () => {
    if (!lockedUntil) return null;
    const remaining = Math.max(0, Math.ceil((new Date(lockedUntil).getTime() - Date.now()) / 1000));
    return remaining;
  };

  const lockedTime = getLockedRemainingTime();
  const isLocked = lockedTime !== null && lockedTime > 0;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm" data-testid="pin-modal">
      <div className="space-y-6">
        <div className="text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center mb-4">
            <Lock className="w-8 h-8 text-primary-500" />
          </div>
          <p className="text-gray-600 dark:text-gray-400">{description}</p>
        </div>

        <div className="flex justify-center gap-3" data-testid="pin-inputs">
          {pin.map((digit, index) => (
            <input
              key={index}
              ref={(el) => { inputRefs.current[index] = el; }}
              type="password"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleInputChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onPaste={handlePaste}
              disabled={isLoading || isLocked}
              data-testid={`pin-input-${index}`}
              className={clsx(
                'w-14 h-14 text-center text-2xl font-bold rounded-lg border-2 transition-all',
                'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent',
                'dark:bg-[#3d322c] dark:text-white',
                error
                  ? 'border-error-500 bg-error-50 dark:bg-error-900/20'
                  : 'border-gray-300 dark:border-primary-800/50',
                (isLoading || isLocked) && 'opacity-50 cursor-not-allowed'
              )}
            />
          ))}
        </div>

        {error && (
          <div className="flex items-center justify-center gap-2 text-error-500" data-testid="pin-error">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {isLocked && (
          <div className="text-center text-sm text-gray-500 dark:text-gray-400">
            {lockedTime}초 후에 다시 시도할 수 있습니다.
          </div>
        )}

        {remainingAttempts !== null && !isLocked && (
          <div className="text-center text-sm text-warning-600 dark:text-warning-400">
            남은 시도 횟수: {remainingAttempts}회
          </div>
        )}

        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={onClose}
            disabled={isLoading}
          >
            취소
          </Button>
          <Button
            className="flex-1"
            onClick={() => handleVerify(pin.join(''))}
            disabled={pin.some(d => d === '') || isLoading || isLocked}
            isLoading={isLoading}
            data-testid="pin-confirm"
          >
            확인
          </Button>
        </div>
      </div>
    </Modal>
  );
}
