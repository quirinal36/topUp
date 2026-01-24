/**
 * 500 Server Error 페이지
 * 서버 오류 발생 시 표시
 */
import { Link, useNavigate } from 'react-router-dom';
import { Home, ArrowLeft, RefreshCw, AlertTriangle } from 'lucide-react';

interface ServerErrorProps {
  onRetry?: () => void;
}

export default function ServerError({ onRetry }: ServerErrorProps) {
  const navigate = useNavigate();

  const handleRetry = () => {
    if (onRetry) {
      onRetry();
    } else {
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-50 to-secondary-100 dark:from-[#1a1412] dark:to-[#2d2420] flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        {/* 아이콘 - 경고 표시가 있는 커피잔 */}
        <div className="mb-8">
          <div className="relative inline-block">
            <span className="text-8xl opacity-50">☕</span>
            <div className="absolute -bottom-2 -right-2 bg-red-100 dark:bg-red-900/50 rounded-full p-2">
              <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
          </div>
        </div>

        {/* 에러 코드 */}
        <h1 className="text-7xl font-bold text-red-600 dark:text-red-400 mb-4">
          500
        </h1>

        {/* 에러 메시지 */}
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">
          서버 오류가 발생했습니다
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          일시적인 문제가 발생했습니다.
          <br />
          잠시 후 다시 시도해 주세요.
        </p>

        {/* 관리자 문의 안내 */}
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-8">
          <p className="text-yellow-800 dark:text-yellow-200 text-sm">
            문제가 계속되면 <strong>관리자에게 문의해 주세요.</strong>
          </p>
        </div>

        {/* 액션 버튼들 */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-button border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#2d2420] text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#3d3430] transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            이전 페이지
          </button>
          <button
            onClick={handleRetry}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-button bg-primary-600 text-white hover:bg-primary-700 transition-colors"
          >
            <RefreshCw className="w-5 h-5" />
            다시 시도
          </button>
        </div>

        {/* 홈 링크 */}
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-primary-600 dark:text-primary-400 hover:underline"
          >
            <Home className="w-4 h-4" />
            홈으로 이동
          </Link>
        </div>
      </div>
    </div>
  );
}
