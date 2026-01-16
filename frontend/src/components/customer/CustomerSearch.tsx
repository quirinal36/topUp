import { useState, useEffect, useRef, FormEvent } from 'react';
import { Search, UserPlus, ArrowUpDown } from 'lucide-react';
import Input from '../common/Input';
import Button from '../common/Button';
import { useCustomerStore } from '../../stores/customerStore';

interface CustomerSearchProps {
  onAddClick: () => void;
}

export default function CustomerSearch({ onAddClick }: CustomerSearchProps) {
  const [inputValue, setInputValue] = useState('');
  const isInitialMount = useRef(true);
  const {
    setSearchQuery,
    fetchCustomers,
    sortBy,
    sortOrder,
    setSortBy,
    setSortOrder
  } = useCustomerStore();

  // 초기 로드 (한 번만)
  useEffect(() => {
    fetchCustomers('');
  }, []);

  // 정렬 변경 시 조회 (초기 마운트 제외)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    fetchCustomers();
  }, [sortBy, sortOrder]);

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    setSearchQuery(inputValue);
    fetchCustomers(inputValue, 1);
  };

  const handleSortChange = (newSortBy: string) => {
    if (sortBy === newSortBy) {
      // 같은 필드 클릭 시 정렬 순서 변경
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(newSortBy);
      setSortOrder('asc');
    }
  };

  return (
    <div className="space-y-3 mb-4">
      {/* 검색 폼 */}
      <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <Input
            type="text"
            placeholder="고객 이름 또는 연락처로 검색..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button type="submit" variant="outline" className="whitespace-nowrap">
          <Search className="w-5 h-5 mr-2" />
          검색
        </Button>
        <Button type="button" onClick={onAddClick} className="whitespace-nowrap">
          <UserPlus className="w-5 h-5 mr-2" />
          고객 등록
        </Button>
      </form>

      {/* 정렬 옵션 */}
      <div className="flex items-center gap-2 text-sm">
        <ArrowUpDown className="w-4 h-4 text-gray-500" />
        <span className="text-gray-500 dark:text-gray-400">정렬:</span>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => handleSortChange('name')}
            className={`px-3 py-1 rounded-full transition-colors ${
              sortBy === 'name'
                ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
            }`}
          >
            이름 {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
          </button>
          <button
            type="button"
            onClick={() => handleSortChange('created_at')}
            className={`px-3 py-1 rounded-full transition-colors ${
              sortBy === 'created_at'
                ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
            }`}
          >
            등록일 {sortBy === 'created_at' && (sortOrder === 'asc' ? '↑' : '↓')}
          </button>
          <button
            type="button"
            onClick={() => handleSortChange('current_balance')}
            className={`px-3 py-1 rounded-full transition-colors ${
              sortBy === 'current_balance'
                ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
            }`}
          >
            잔액 {sortBy === 'current_balance' && (sortOrder === 'asc' ? '↑' : '↓')}
          </button>
        </div>
      </div>
    </div>
  );
}
