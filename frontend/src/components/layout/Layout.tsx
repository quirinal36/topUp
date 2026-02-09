import { useState, useEffect, useRef, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [headerVisible, setHeaderVisible] = useState(false);
  const lastScrollY = useRef(0);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      // 위로 스크롤하면 헤더 표시
      if (currentScrollY < lastScrollY.current && currentScrollY > 0) {
        setHeaderVisible(true);
        // 자동 숨김 타이머 리셋
        if (hideTimeoutRef.current) {
          clearTimeout(hideTimeoutRef.current);
        }
        hideTimeoutRef.current = setTimeout(() => {
          setHeaderVisible(false);
        }, 3000);
      }
      // 맨 위에서 아래로 스크롤하면 숨김
      else if (currentScrollY > lastScrollY.current && currentScrollY > 64) {
        setHeaderVisible(false);
      }

      lastScrollY.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, []);

  // 상단 터치 영역 핸들러
  const handleTopAreaInteraction = () => {
    setHeaderVisible(true);
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
    }
    hideTimeoutRef.current = setTimeout(() => {
      setHeaderVisible(false);
    }, 3000);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#1a1412]">
      {/* 상단 터치 감지 영역 */}
      <div
        className="fixed top-0 left-0 right-0 h-4 z-50"
        onMouseEnter={handleTopAreaInteraction}
        onTouchStart={handleTopAreaInteraction}
      />

      {/* 헤더 - 슬라이드 애니메이션 */}
      <div
        className={`fixed top-0 left-0 right-0 z-40 transition-transform duration-300 ease-in-out ${
          headerVisible ? 'translate-y-0' : '-translate-y-full'
        }`}
      >
        <Header onMenuClick={() => setSidebarOpen(true)} />
      </div>

      <div className="flex">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <main className="flex-1 p-4 lg:p-6">
          {children}

          {/* Footer */}
          <footer className="mt-8 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-center gap-3 text-xs text-gray-400 dark:text-gray-500">
              <Link to="/terms" className="hover:text-primary-600 dark:hover:text-primary-400 underline">이용약관</Link>
              <span>|</span>
              <Link to="/privacy" className="hover:text-primary-600 dark:hover:text-primary-400 underline">개인정보처리방침</Link>
            </div>
            <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-2 pb-4">
              &copy; 2026 커밍스(Comings). All rights reserved.
            </p>
          </footer>
        </main>
      </div>
    </div>
  );
}
