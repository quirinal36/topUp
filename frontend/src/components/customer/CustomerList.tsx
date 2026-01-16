import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useCustomerStore } from '../../stores/customerStore';
import CustomerCard from './CustomerCard';
import Button from '../common/Button';

export default function CustomerList() {
  const navigate = useNavigate();
  const { customers, isLoading, page, total, pageSize, searchQuery, fetchCustomers } = useCustomerStore();

  const totalPages = Math.ceil(total / pageSize);
  const hasSearchQuery = searchQuery && searchQuery.trim().length > 0;

  const handlePageChange = (newPage: number) => {
    fetchCustomers(undefined, newPage);
  };

  // 로딩 중일 때는 항상 스피너 표시
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="animate-spin w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full" />
        <p className="mt-4 text-gray-500 dark:text-gray-400">
          {hasSearchQuery ? '검색 중...' : '고객 목록을 불러오는 중...'}
        </p>
      </div>
    );
  }

  // 결과가 없을 때 - 검색 여부에 따라 다른 메시지 표시
  if (customers.length === 0) {
    if (hasSearchQuery) {
      // 검색 결과가 없는 경우
      return (
        <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400">
          <Search className="w-12 h-12 mb-4 opacity-50" />
          <p className="text-lg">"{searchQuery}"에 대한 검색 결과가 없습니다.</p>
          <p className="text-sm mt-1">다른 검색어를 입력해보세요.</p>
        </div>
      );
    }
    // 등록된 고객이 없는 경우
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        <p className="text-lg">등록된 고객이 없습니다.</p>
        <p className="text-sm mt-1">새로운 고객을 등록해주세요.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {customers.map((customer) => (
          <CustomerCard
            key={customer.id}
            customer={customer}
            onClick={() => navigate(`/customers/${customer.id}`)}
          />
        ))}
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(page - 1)}
            disabled={page <= 1}
          >
            이전
          </Button>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(page + 1)}
            disabled={page >= totalPages}
          >
            다음
          </Button>
        </div>
      )}
    </div>
  );
}
