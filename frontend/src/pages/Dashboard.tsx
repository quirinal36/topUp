import { useEffect, useState, useCallback } from 'react';
import { Wallet, Search, Plus, Minus, UserPlus } from 'lucide-react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Modal from '../components/common/Modal';
import Input from '../components/common/Input';
import ChargeModal from '../components/transaction/ChargeModal';
import DeductModal from '../components/transaction/DeductModal';
import { getDashboardSummary } from '../api/dashboard';
import { getCustomers, createCustomer } from '../api/customers';
import { DashboardSummary, Customer } from '../types';

export default function Dashboard() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState(''); // 입력 필드용 상태
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 30;

  // Modal states
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isChargeModalOpen, setIsChargeModalOpen] = useState(false);
  const [isDeductModalOpen, setIsDeductModalOpen] = useState(false);
  const [isAddCustomerModalOpen, setIsAddCustomerModalOpen] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR').format(amount) + '원';
  };

  const fetchData = useCallback(async () => {
    try {
      const [summaryData, customerData] = await Promise.all([
        getDashboardSummary(),
        getCustomers({ query: searchQuery, page, page_size: pageSize }),
      ]);
      setSummary(summaryData);
      setCustomers(customerData.customers);
      setTotal(customerData.total);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, page]);

  useEffect(() => {
    setIsLoading(true);
    fetchData();
  }, [fetchData]);

  // 검색 버튼 클릭 핸들러
  const handleSearch = () => {
    setSearchQuery(searchInput);
    setPage(1);
  };

  // Enter 키로 검색
  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  const handleChargeClick = (customer: Customer, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedCustomer(customer);
    setIsChargeModalOpen(true);
  };

  const handleDeductClick = (customer: Customer, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedCustomer(customer);
    setIsDeductModalOpen(true);
  };

  const handleTransactionSuccess = () => {
    fetchData();
  };

  const handleAddCustomer = async () => {
    if (!newCustomerName.trim()) return;

    setIsAddingCustomer(true);
    try {
      await createCustomer({
        name: newCustomerName.trim(),
        phone_suffix: newCustomerPhone.trim() || '0000',
      });
      setNewCustomerName('');
      setNewCustomerPhone('');
      setIsAddCustomerModalOpen(false);
      fetchData();
    } catch (error) {
      console.error('Failed to create customer:', error);
    } finally {
      setIsAddingCustomer(false);
    }
  };

  if (isLoading && !customers.length) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 총 예치금 Hero Section */}
      <Card className="bg-gradient-to-r from-primary-500 to-primary-600 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-primary-100 text-sm font-medium">모든 고객 총 예치금</p>
            <p className="text-4xl font-bold mt-1">
              {formatCurrency(summary?.total_balance || 0)}
            </p>
            <p className="text-primary-200 text-sm mt-2">
              총 {summary?.total_customers || 0}명의 고객
            </p>
          </div>
          <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
            <Wallet className="w-8 h-8 text-white" />
          </div>
        </div>
      </Card>

      {/* 검색 및 고객 추가 */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="고객 이름 또는 연락처로 검색..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            className="w-full pl-10 pr-4 py-3 rounded-button border border-gray-200 dark:border-primary-800/50 bg-white dark:bg-primary-900/20 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <Button onClick={handleSearch} variant="outline">
          <Search className="w-5 h-5 mr-1" />
          검색
        </Button>
        <Button onClick={() => setIsAddCustomerModalOpen(true)}>
          <UserPlus className="w-5 h-5 mr-1" />
          고객 등록
        </Button>
      </div>

      {/* 고객 리스트 */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-heading-3 text-gray-900 dark:text-white">
            고객 목록
            <span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-2">
              ({total}명)
            </span>
          </h2>
        </div>

        {customers.length === 0 ? (
          <Card>
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <p>
                {searchQuery ? '검색 결과가 없습니다.' : '등록된 고객이 없습니다.'}
              </p>
              {!searchQuery && (
                <p className="text-sm mt-1">새로운 고객을 등록해주세요.</p>
              )}
            </div>
          </Card>
        ) : (
          <div className="space-y-3">
            {customers.map((customer) => (
              <Card key={customer.id} className="hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  {/* 고객 정보 */}
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                      <span className="text-lg font-bold text-primary-600 dark:text-primary-400">
                        {customer.name.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {customer.name}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        ***-****-{customer.phone_suffix}
                      </p>
                    </div>
                  </div>

                  {/* 잔액 및 액션 버튼 */}
                  <div className="flex items-center gap-4">
                    <div className="text-right mr-4">
                      <p className="text-sm text-gray-500 dark:text-gray-400">잔액</p>
                      <p className={`text-xl font-bold ${
                        customer.current_balance >= 0
                          ? 'text-primary-600 dark:text-primary-400'
                          : 'text-error-500'
                      }`}>
                        {formatCurrency(customer.current_balance)}
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="success"
                        size="sm"
                        onClick={(e) => handleChargeClick(customer, e)}
                        className="flex items-center gap-1"
                      >
                        <Plus className="w-4 h-4" />
                        충전
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => handleDeductClick(customer, e)}
                        className="flex items-center gap-1"
                      >
                        <Minus className="w-4 h-4" />
                        결제
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              이전
            </Button>
            <span className="text-sm text-gray-600 dark:text-gray-400 px-4">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              다음
            </Button>
          </div>
        )}
      </div>

      {/* 충전 모달 */}
      {selectedCustomer && (
        <>
          <ChargeModal
            isOpen={isChargeModalOpen}
            onClose={() => {
              setIsChargeModalOpen(false);
              setSelectedCustomer(null);
            }}
            customerId={selectedCustomer.id}
            customerName={selectedCustomer.name}
            onSuccess={handleTransactionSuccess}
          />
          <DeductModal
            isOpen={isDeductModalOpen}
            onClose={() => {
              setIsDeductModalOpen(false);
              setSelectedCustomer(null);
            }}
            customerId={selectedCustomer.id}
            customerName={selectedCustomer.name}
            currentBalance={selectedCustomer.current_balance}
            onSuccess={handleTransactionSuccess}
          />
        </>
      )}

      {/* 고객 추가 모달 */}
      <Modal
        isOpen={isAddCustomerModalOpen}
        onClose={() => {
          setIsAddCustomerModalOpen(false);
          setNewCustomerName('');
          setNewCustomerPhone('');
        }}
        title="새 고객 등록"
        size="sm"
      >
        <div className="space-y-4">
          <Input
            label="고객 이름"
            placeholder="홍길동"
            value={newCustomerName}
            onChange={(e) => setNewCustomerName(e.target.value)}
          />
          <Input
            label="연락처 뒷자리 (4자리)"
            placeholder="1234"
            maxLength={4}
            value={newCustomerPhone}
            onChange={(e) => setNewCustomerPhone(e.target.value.replace(/\D/g, ''))}
          />
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsAddCustomerModalOpen(false);
                setNewCustomerName('');
                setNewCustomerPhone('');
              }}
              className="flex-1"
            >
              취소
            </Button>
            <Button
              onClick={handleAddCustomer}
              isLoading={isAddingCustomer}
              disabled={!newCustomerName.trim()}
              className="flex-1"
            >
              등록하기
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
