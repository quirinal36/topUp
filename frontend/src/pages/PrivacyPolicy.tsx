import { ChevronLeft } from 'lucide-react';
import MarkdownRenderer from '../components/MarkdownRenderer';
import privacyContent from '../content/legal/privacy.md?raw';

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#1a1412]">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <button
          onClick={() => window.history.back()}
          className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 mb-6"
        >
          <ChevronLeft className="w-4 h-4" />
          뒤로가기
        </button>

        <div className="bg-white dark:bg-[#2d2420] rounded-xl shadow-sm p-6 md:p-8">
          <MarkdownRenderer content={privacyContent} />
        </div>
      </div>
    </div>
  );
}
