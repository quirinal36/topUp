import { NavLink } from 'react-router-dom';
import { Home, Users, Receipt, BarChart3, Settings, X } from 'lucide-react';
import { clsx } from 'clsx';
import Button from '../common/Button';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const navItems = [
  { path: '/', icon: Home, label: '대시보드' },
  { path: '/customers', icon: Users, label: '고객 관리' },
  { path: '/transactions', icon: Receipt, label: '거래 내역' },
  { path: '/analytics', icon: BarChart3, label: '통계' },
  { path: '/settings', icon: Settings, label: '설정' },
];

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  return (
    <>
      {/* 모바일 오버레이 */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* 사이드바 */}
      <aside
        className={clsx(
          'fixed left-0 top-0 h-full w-64 bg-white border-r border-gray-200 z-50',
          'dark:bg-[#2d2420] dark:border-primary-800/30',
          'lg:translate-x-0 lg:static lg:z-auto',
          'transition-transform duration-300',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* 모바일 닫기 버튼 */}
        <div className="flex items-center justify-between p-4 lg:hidden">
          <span className="text-lg font-semibold">메뉴</span>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* 네비게이션 */}
        <nav className="p-4 space-y-1">
          {navItems.map(({ path, icon: Icon, label }) => (
            <NavLink
              key={path}
              to={path}
              onClick={onClose}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 px-4 py-3 rounded-button transition-colors',
                  'min-h-touch',
                  isActive
                    ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400'
                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-primary-900/20'
                )
              }
            >
              <Icon className="w-5 h-5" />
              <span className="font-medium">{label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  );
}
