/**
 * 404 Not Found 페이지
 * 존재하지 않는 페이지 접근 시 표시
 */
import { Link, useNavigate } from 'react-router-dom';
import { Home, ArrowLeft, Search } from 'lucide-react';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-50 to-secondary-100 dark:from-[#1a1412] dark:to-[#2d2420] flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        {/* 아이콘 - 빈 커피잔 */}
        <div className="mb-8">
          <div className="relative inline-block">
            <span className="text-8xl opacity-50">☕</span>
            <div className="absolute -bottom-2 -right-2 bg-primary-100 dark:bg-primary-900/50 rounded-full p-2">
              <Search className="w-8 h-8 text-primary-600 dark:text-primary-400" />
            </div>
          </div>
        </div>

        {/* 에러 코드 */}
        <h1 className="text-7xl font-bold text-primary-600 dark:text-primary-400 mb-4">
          404
        </h1>

        {/* 에러 메시지 */}
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">
          페이지를 찾을 수 없습니다
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          요청하신 페이지가 존재하지 않거나 이동되었을 수 있습니다.
          <br />
          주소를 다시 확인해 주세요.
        </p>

        {/* 액션 버튼들 */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-button border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#2d2420] text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#3d3430] transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            이전 페이지
          </button>
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-button bg-primary-600 text-white hover:bg-primary-700 transition-colors"
          >
            <Home className="w-5 h-5" />
            홈으로 이동
          </Link>
        </div>

        {/* 추가 안내 */}
        <p className="mt-10 text-sm text-gray-400 dark:text-gray-500">
          문제가 계속되면{' '}
          <Link to="/settings" className="text-primary-600 dark:text-primary-400 hover:underline">
            설정
          </Link>
          에서 도움을 받으세요.
        </p>
      </div>
    </div>
  );
}
