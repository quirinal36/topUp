import { useState, useCallback } from 'react';

interface UsePinVerifyReturn {
  isPinModalOpen: boolean;
  openPinModal: () => void;
  closePinModal: () => void;
  withPinVerification: <T>(action: () => Promise<T> | T) => void;
  pendingAction: (() => void) | null;
  handlePinVerified: () => void;
}

export function usePinVerify(): UsePinVerifyReturn {
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const openPinModal = useCallback(() => {
    setIsPinModalOpen(true);
  }, []);

  const closePinModal = useCallback(() => {
    setIsPinModalOpen(false);
    setPendingAction(null);
  }, []);

  const withPinVerification = useCallback(<T,>(action: () => Promise<T> | T) => {
    setPendingAction(() => action);
    setIsPinModalOpen(true);
  }, []);

  const handlePinVerified = useCallback(() => {
    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
    setIsPinModalOpen(false);
  }, [pendingAction]);

  return {
    isPinModalOpen,
    openPinModal,
    closePinModal,
    withPinVerification,
    pendingAction,
    handlePinVerified,
  };
}

export default usePinVerify;
