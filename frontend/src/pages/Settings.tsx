import { useState, useEffect } from 'react';
import { Moon, Sun, Key, Link2, Store, Edit2, BookText, Plus, Trash2, FileText, Users } from 'lucide-react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import Modal from '../components/common/Modal';
import CustomerDataManagement from '../components/settings/CustomerDataManagement';
import { useAuthStore } from '../stores/authStore';
import { changePin, updateShop } from '../api/auth';
import { getMenus, createMenu, updateMenu, deleteMenu } from '../api/menus';
import { useToast } from '../contexts/ToastContext';
import { Menu } from '../types';

export default function Settings() {
  const toast = useToast();
  const { darkMode, toggleDarkMode, shopName, setShopName } = useAuthStore();

  // 상점명 수정 상태
  const [isShopNameModalOpen, setIsShopNameModalOpen] = useState(false);
  const [newShopName, setNewShopName] = useState('');
  const [shopNameError, setShopNameError] = useState('');
  const [isShopNameSubmitting, setIsShopNameSubmitting] = useState(false);

  // PIN 변경 상태
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 메뉴 관리 상태
  const [menus, setMenus] = useState<Menu[]>([]);
  const [isMenusLoading, setIsMenusLoading] = useState(true);
  const [isMenuModalOpen, setIsMenuModalOpen] = useState(false);
  const [editingMenu, setEditingMenu] = useState<Menu | null>(null);
  const [menuName, setMenuName] = useState('');
  const [menuPrice, setMenuPrice] = useState('');
  const [menuError, setMenuError] = useState('');
  const [isMenuSubmitting, setIsMenuSubmitting] = useState(false);

  // 메뉴 목록 로드
  useEffect(() => {
    const loadMenus = async () => {
      try {
        const result = await getMenus(true);
        setMenus(result.menus);
      } catch {
        toast.error('메뉴 목록을 불러오지 못했습니다');
      } finally {
        setIsMenusLoading(false);
      }
    };
    loadMenus();
  }, [toast]);

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
      toast.success('PIN이 변경되었습니다');
      handleClosePinModal();
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || 'PIN 변경에 실패했습니다';
      toast.error(errorMsg);
      setPinError(errorMsg);
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

  const handleOpenShopNameModal = () => {
    setNewShopName(shopName || '');
    setShopNameError('');
    setIsShopNameModalOpen(true);
  };

  const handleCloseShopNameModal = () => {
    setIsShopNameModalOpen(false);
    setNewShopName('');
    setShopNameError('');
  };

  const handleShopNameChange = async () => {
    if (!newShopName.trim()) {
      setShopNameError('상점명을 입력해주세요');
      return;
    }

    setIsShopNameSubmitting(true);
    setShopNameError('');

    try {
      const result = await updateShop(newShopName.trim());
      setShopName(result.name);
      toast.success('상점명이 변경되었습니다');
      handleCloseShopNameModal();
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || '상점명 변경에 실패했습니다';
      toast.error(errorMsg);
      setShopNameError(errorMsg);
    } finally {
      setIsShopNameSubmitting(false);
    }
  };

  // 메뉴 모달 열기 (추가/수정)
  const handleOpenMenuModal = (menu?: Menu) => {
    if (menu) {
      setEditingMenu(menu);
      setMenuName(menu.name);
      setMenuPrice(menu.price.toString());
    } else {
      setEditingMenu(null);
      setMenuName('');
      setMenuPrice('');
    }
    setMenuError('');
    setIsMenuModalOpen(true);
  };

  const handleCloseMenuModal = () => {
    setIsMenuModalOpen(false);
    setEditingMenu(null);
    setMenuName('');
    setMenuPrice('');
    setMenuError('');
  };

  // 메뉴 저장 (추가/수정)
  const handleSaveMenu = async () => {
    if (!menuName.trim()) {
      setMenuError('메뉴명을 입력해주세요');
      return;
    }
    const price = parseInt(menuPrice.replace(/\D/g, ''), 10) || 0;
    if (price < 0) {
      setMenuError('가격은 0 이상이어야 합니다');
      return;
    }

    setIsMenuSubmitting(true);
    setMenuError('');

    try {
      if (editingMenu) {
        // 수정
        const updated = await updateMenu(editingMenu.id, { name: menuName.trim(), price });
        setMenus(menus.map((m) => (m.id === updated.id ? updated : m)));
        toast.success('메뉴가 수정되었습니다');
      } else {
        // 추가
        const created = await createMenu({ name: menuName.trim(), price });
        setMenus([...menus, created]);
        toast.success('메뉴가 추가되었습니다');
      }
      handleCloseMenuModal();
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || '저장에 실패했습니다';
      toast.error(errorMsg);
      setMenuError(errorMsg);
    } finally {
      setIsMenuSubmitting(false);
    }
  };

  // 메뉴 삭제
  const handleDeleteMenu = async (menu: Menu) => {
    if (!confirm(`"${menu.name}" 메뉴를 삭제하시겠습니까?`)) return;

    try {
      await deleteMenu(menu.id);
      setMenus(menus.filter((m) => m.id !== menu.id));
      toast.success('메뉴가 삭제되었습니다');
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || '삭제에 실패했습니다';
      toast.error(errorMsg);
    }
  };

  // 가격 포맷
  const formatPrice = (value: string): string => {
    const num = parseInt(value.replace(/\D/g, ''), 10);
    return isNaN(num) ? '' : num.toLocaleString();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-heading-2 text-gray-900 dark:text-white">설정</h1>

      {/* 상점 정보 */}
      <Card>
        <h2 className="text-heading-3 text-gray-900 dark:text-white mb-4">상점 정보</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Store className="w-5 h-5 text-primary-500" />
              <div>
                <p className="font-medium text-gray-900 dark:text-white">{shopName || '내 카페'}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">상점명</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleOpenShopNameModal}>
              <Edit2 className="w-4 h-4 mr-1" />
              수정
            </Button>
          </div>
        </div>
      </Card>

      {/* 메뉴 관리 */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-heading-3 text-gray-900 dark:text-white">메뉴 관리</h2>
          <Button variant="outline" size="sm" onClick={() => handleOpenMenuModal()}>
            <Plus className="w-4 h-4 mr-1" />
            추가
          </Button>
        </div>

        {isMenusLoading ? (
          <div className="text-center py-4 text-gray-500 dark:text-gray-400">
            로딩 중...
          </div>
        ) : menus.length === 0 ? (
          <div className="text-center py-6">
            <BookText className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              등록된 메뉴가 없습니다
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => handleOpenMenuModal()}
            >
              <Plus className="w-4 h-4 mr-1" />
              첫 메뉴 추가하기
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {menus.map((menu) => (
              <div
                key={menu.id}
                className={`flex items-center justify-between p-3 rounded-lg ${
                  menu.is_active
                    ? 'bg-gray-50 dark:bg-gray-800'
                    : 'bg-gray-100 dark:bg-gray-900 opacity-60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <BookText className="w-5 h-5 text-primary-500" />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {menu.name}
                      {!menu.is_active && (
                        <span className="ml-2 text-xs text-gray-500">(비활성)</span>
                      )}
                    </p>
                    <p className="text-sm text-primary-600 dark:text-primary-400">
                      {menu.price.toLocaleString()}원
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleOpenMenuModal(menu)}
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-error-500 hover:text-error-600"
                    onClick={() => handleDeleteMenu(menu)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="mt-3 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
          <FileText size={12} />
          메뉴는 고객에게 표시되며, 빠른 결제에 활용됩니다.
        </p>
      </Card>

      {/* 고객 데이터 관리 */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-primary-500" />
          <h2 className="text-heading-3 text-gray-900 dark:text-white">고객 데이터 관리</h2>
        </div>
        <CustomerDataManagement />
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
              className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform ${
                darkMode ? 'translate-x-6' : 'translate-x-0'
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
          <p>선결제 관리 플랫폼 커밍스</p>
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

      {/* 상점명 수정 모달 */}
      <Modal isOpen={isShopNameModalOpen} onClose={handleCloseShopNameModal} title="상점명 수정">
        <div className="space-y-4">
          <Input
            label="상점명"
            placeholder="내 카페"
            value={newShopName}
            onChange={(e) => setNewShopName(e.target.value)}
            maxLength={100}
          />

          {shopNameError && <p className="text-error-500 text-sm">{shopNameError}</p>}

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={handleCloseShopNameModal} className="flex-1">
              취소
            </Button>
            <Button onClick={handleShopNameChange} isLoading={isShopNameSubmitting} className="flex-1">
              저장
            </Button>
          </div>
        </div>
      </Modal>

      {/* 메뉴 추가/수정 모달 */}
      <Modal
        isOpen={isMenuModalOpen}
        onClose={handleCloseMenuModal}
        title={editingMenu ? '메뉴 수정' : '메뉴 추가'}
      >
        <div className="space-y-4">
          <Input
            label="메뉴명"
            placeholder="아메리카노"
            value={menuName}
            onChange={(e) => setMenuName(e.target.value)}
            maxLength={100}
          />
          <Input
            label="가격"
            placeholder="4,500"
            value={formatPrice(menuPrice)}
            onChange={(e) => setMenuPrice(e.target.value.replace(/\D/g, ''))}
          />

          {menuError && <p className="text-error-500 text-sm">{menuError}</p>}

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={handleCloseMenuModal} className="flex-1">
              취소
            </Button>
            <Button onClick={handleSaveMenu} isLoading={isMenuSubmitting} className="flex-1">
              {editingMenu ? '수정' : '추가'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
