import { useState } from 'react';
import { Moon, Sun, Key, Link2, Shield } from 'lucide-react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import Modal from '../components/common/Modal';
import { useAuthStore } from '../stores/authStore';
import { changePin } from '../api/auth';

export default function Settings() {
  const { darkMode, toggleDarkMode, shopName } = useAuthStore();
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePinChange = async () => {
    if (!currentPin || currentPin.length !== 4) {
      setPinError('현재 PIN 4자리를 입력해주세요');
      return;
    }
    if (!newPin || newPin.length !== 4) {
      setPinError('새 PIN 4자리를 입력해주세요');
      return;
    }
    if (newPin !== confirmPin) {
      setPinError('새 PIN이 일치하지 않습니다');
      return;
    }

    setIsSubmitting(true);
    setPinError('');

    try {
      await changePin(currentPin, newPin);
      handleClosePinModal();
      alert('PIN이 변경되었습니다');
    } catch (error: any) {
      setPinError(error.response?.data?.detail || 'PIN 변경에 실패했습니다');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClosePinModal = () => {
    setIsPinModalOpen(false);
    setCurrentPin('');
    setNewPin('');
    setConfirmPin('');
    setPinError('');
  };

  return (
    <div className="space-y-6">
      <h1 className="text-heading-2 text-gray-900 dark:text-white">설정</h1>

      {/* 상점 정보 */}
      <Card>
        <h2 className="text-heading-3 text-gray-900 dark:text-white mb-4">상점 정보</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-gray-600 dark:text-gray-400">상점명</span>
            <span className="font-medium text-gray-900 dark:text-white">{shopName || '내 카페'}</span>
          </div>
        </div>
      </Card>

      {/* 디스플레이 설정 */}
      <Card>
        <h2 className="text-heading-3 text-gray-900 dark:text-white mb-4">디스플레이</h2>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {darkMode ? <Moon className="w-5 h-5 text-primary-500" /> : <Sun className="w-5 h-5 text-warning-500" />}
            <div>
              <p className="font-medium text-gray-900 dark:text-white">다크 모드</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                어두운 환경에서 눈의 피로를 줄여줍니다
              </p>
            </div>
          </div>
          <button
            onClick={toggleDarkMode}
            className={`relative w-14 h-8 rounded-full transition-colors ${
              darkMode ? 'bg-primary-500' : 'bg-gray-300'
            }`}
          >
            <span
              className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-transform ${
                darkMode ? 'translate-x-7' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </Card>

      {/* 보안 설정 */}
      <Card>
        <h2 className="text-heading-3 text-gray-900 dark:text-white mb-4">보안</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Key className="w-5 h-5 text-primary-500" />
              <div>
                <p className="font-medium text-gray-900 dark:text-white">PIN 변경</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  민감한 작업 시 필요한 4자리 PIN을 변경합니다
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={() => setIsPinModalOpen(true)}>
              변경
            </Button>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link2 className="w-5 h-5 text-primary-500" />
              <div>
                <p className="font-medium text-gray-900 dark:text-white">소셜 계정 연동</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  네이버, 카카오 계정을 연동하여 로그인할 수 있습니다
                </p>
              </div>
            </div>
            <Button variant="outline" disabled>
              관리
            </Button>
          </div>
        </div>
      </Card>

      {/* 정보 */}
      <Card>
        <h2 className="text-heading-3 text-gray-900 dark:text-white mb-4">정보</h2>
        <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
          <p>버전: 1.0.0</p>
          <p>카페 선결제 관리 시스템</p>
        </div>
      </Card>

      {/* PIN 변경 모달 */}
      <Modal isOpen={isPinModalOpen} onClose={handleClosePinModal} title="PIN 변경">
        <div className="space-y-4">
          <Input
            label="현재 PIN"
            type="password"
            maxLength={4}
            placeholder="****"
            value={currentPin}
            onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ''))}
          />
          <Input
            label="새 PIN"
            type="password"
            maxLength={4}
            placeholder="****"
            value={newPin}
            onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
          />
          <Input
            label="새 PIN 확인"
            type="password"
            maxLength={4}
            placeholder="****"
            value={confirmPin}
            onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
          />

          {pinError && <p className="text-error-500 text-sm">{pinError}</p>}

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={handleClosePinModal} className="flex-1">
              취소
            </Button>
            <Button onClick={handlePinChange} isLoading={isSubmitting} className="flex-1">
              변경하기
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
