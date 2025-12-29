import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCustomerStore } from '../../stores/customerStore';
import CustomerCard from './CustomerCard';
import Button from '../common/Button';

export default function CustomerList() {
  const navigate = useNavigate();
  const { customers, isLoading, page, total, pageSize, fetchCustomers } = useCustomerStore();

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const totalPages = Math.ceil(total / pageSize);

  const handlePageChange = (newPage: number) => {
    fetchCustomers(undefined, newPage);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (customers.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        <p>등록된 고객이 없습니다.</p>
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
