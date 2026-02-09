import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

export default function Terms() {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/legal/terms.md')
      .then((res) => res.text())
      .then((text) => {
        setContent(text);
        setLoading(false);
      })
      .catch(() => {
        setContent('이용약관을 불러오는 데 실패했습니다.');
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#1a1412]">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Link
          to={-1 as unknown as string}
          onClick={(e) => {
            e.preventDefault();
            window.history.back();
          }}
          className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 mb-6"
        >
          <ChevronLeft className="w-4 h-4" />
          뒤로가기
        </Link>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-gray-500 dark:text-gray-400">로딩 중...</div>
          </div>
        ) : (
          <div className="bg-white dark:bg-[#2d2420] rounded-xl shadow-sm p-6 md:p-8">
            <div className="prose dark:prose-invert prose-sm max-w-none whitespace-pre-wrap break-words text-gray-700 dark:text-gray-300 leading-relaxed font-sans">
              {content}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
