import { Moon, Sun, LogOut, Menu } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import Button from '../common/Button';

interface HeaderProps {
  onMenuClick?: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const { shopName, darkMode, toggleDarkMode, logout } = useAuthStore();

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-gray-200 dark:bg-[#2d2420] dark:border-primary-800/30">
      <div className="flex items-center justify-between h-16 px-4">
        {/* 왼쪽: 메뉴 버튼 & 로고 */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onMenuClick}
            className="lg:hidden"
          >
            <Menu className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <span className="text-2xl">☕</span>
            <h1 className="text-lg font-semibold text-primary-600 dark:text-primary-400">
              {shopName || '커밍스'}
            </h1>
          </div>
        </div>

        {/* 오른쪽: 테마 토글 & 로그아웃 */}
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={toggleDarkMode}>
            {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </Button>
          <Button variant="ghost" size="sm" onClick={logout}>
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </header>
  );
}
