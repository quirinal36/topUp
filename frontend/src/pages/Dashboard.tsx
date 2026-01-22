import { useEffect, useState, useCallback, useRef } from 'react';
import { Wallet, Search, Plus, Minus, UserPlus, Clock, Coffee } from 'lucide-react';
import { clsx } from 'clsx';
import Button from '../components/common/Button';
import Modal from '../components/common/Modal';
import Input from '../components/common/Input';
import ChargeModal from '../components/transaction/ChargeModal';
import DeductModal from '../components/transaction/DeductModal';
import CustomerCard from '../components/customer/CustomerCard';
import Numpad from '../components/pos/Numpad';
import { getDashboardSummary } from '../api/dashboard';
import { getCustomers, createCustomer } from '../api/customers';
import { getTransactions } from '../api/transactions';
import { DashboardSummary, Customer, Transaction } from '../types';
import { audioFeedback } from '../utils/audioFeedback';

export default function Dashboard() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [phoneDigits, setPhoneDigits] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 30;

  // Refs for customer cards and debounce
  const customerCardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // 고객 검색만 수행 (빠른 응답)
  const searchCustomers = useCallback(async (searchQuery: string) => {
    setIsSearching(true);
    try {
      const customerData = await getCustomers({
        page: 1,
        page_size: pageSize,
        query: searchQuery || undefined
      });
      setCustomers(customerData.customers);
      setTotal(customerData.total);
    } catch (error) {
      console.error('Failed to search customers:', error);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // 전체 데이터 로드 (초기 로드, 거래 후 갱신)
  const fetchData = useCallback(async (searchQuery?: string, pageNum?: number) => {
    try {
      const currentPage = pageNum ?? page;
      const [summaryData, customerData, transactionData] = await Promise.all([
        getDashboardSummary(),
        getCustomers({
          page: searchQuery ? 1 : currentPage,
          page_size: pageSize,
          query: searchQuery || undefined
        }),
        getTransactions({ page: 1, page_size: 5 }),
      ]);
      setSummary(summaryData);
      setCustomers(customerData.customers);
      setTotal(customerData.total);
      setRecentTransactions(transactionData.transactions);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setIsLoading(false);
      setIsSearching(false);
    }
  }, [page]);

  useEffect(() => {
    setIsLoading(true);
    fetchData();
    // Initialize audio
    audioFeedback.init();
  }, [fetchData]);

  // 서버 사이드 검색으로 변경 - 클라이언트 필터링 제거
  const filteredCustomers = customers;

  // 넘패드 검색 - 디바운스 적용 (150ms)
  const handleNumpadChange = (value: string) => {
    setPhoneDigits(value);
    audioFeedback.playTap();

    // 이전 타이머 취소
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // 디바운스: 150ms 후 검색 실행
    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(() => {
      searchCustomers(value);
    }, 150);
  };

  // 컴포넌트 언마운트 시 타이머 정리
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  const totalPages = Math.ceil(total / pageSize);

  const handleChargeClick = (customer: Customer) => {
    setSelectedCustomer(customer);
    setIsChargeModalOpen(true);
    audioFeedback.playSelect();
  };

  const handleDeductClick = (customer: Customer) => {
    setSelectedCustomer(customer);
    setIsDeductModalOpen(true);
    audioFeedback.playSelect();
  };

  const handleCustomerSelect = (customer: Customer) => {
    setSelectedCustomer(customer);
    audioFeedback.playSelect();

    // 선택된 고객 카드로 스크롤
    const cardElement = customerCardRefs.current.get(customer.id);
    if (cardElement) {
      cardElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // 낙관적 업데이트: 즉시 UI에 잔액 변경 반영
  const handleOptimisticUpdate = useCallback((customerId: string, amountChange: number) => {
    // 고객 목록 업데이트
    setCustomers(prev => prev.map(c =>
      c.id === customerId
        ? { ...c, current_balance: c.current_balance + amountChange }
        : c
    ));

    // 선택된 고객 업데이트
    setSelectedCustomer(prev =>
      prev && prev.id === customerId
        ? { ...prev, current_balance: prev.current_balance + amountChange }
        : prev
    );

    // 총 예치금 업데이트
    setSummary(prev =>
      prev
        ? { ...prev, total_balance: prev.total_balance + amountChange }
        : prev
    );
  }, []);

  // 롤백: API 실패 시 원래 값으로 복구
  const handleRollback = useCallback((customerId: string, amountChange: number) => {
    // amountChange를 반대로 적용하여 롤백
    handleOptimisticUpdate(customerId, -amountChange);
  }, [handleOptimisticUpdate]);

  const handleTransactionSuccess = async () => {
    // 선택된 고객 ID를 저장
    const selectedId = selectedCustomer?.id;

    try {
      const [summaryData, customerData, transactionData] = await Promise.all([
        getDashboardSummary(),
        getCustomers({ page, page_size: pageSize }),
        getTransactions({ page: 1, page_size: 5 }),
      ]);
      setSummary(summaryData);
      setCustomers(customerData.customers);
      setTotal(customerData.total);
      setRecentTransactions(transactionData.transactions);

      // 선택된 고객의 최신 데이터로 업데이트
      if (selectedId) {
        const updatedCustomer = customerData.customers.find(c => c.id === selectedId);
        if (updatedCustomer) {
          setSelectedCustomer(updatedCustomer);
        } else {
          setSelectedCustomer(null);
        }
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    }
  };

  const handleAddCustomer = async () => {
    if (!newCustomerName.trim()) return;
    if (!newCustomerPhone || newCustomerPhone.length !== 4 || !/^\d{4}$/.test(newCustomerPhone)) {
      audioFeedback.playError();
      return;
    }

    setIsAddingCustomer(true);
    try {
      await createCustomer({
        name: newCustomerName.trim(),
        phone_suffix: newCustomerPhone,
      });
      audioFeedback.playSuccess();
      setNewCustomerName('');
      setNewCustomerPhone('');
      setIsAddCustomerModalOpen(false);
      fetchData();
    } catch (error) {
      audioFeedback.playError();
      console.error('Failed to create customer:', error);
    } finally {
      setIsAddingCustomer(false);
    }
  };

  // 최근 거래 시간 표시
  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - date.getTime()) / 60000);

    if (diffMinutes < 1) return '방금';
    if (diffMinutes < 60) return `${diffMinutes}분 전`;
    if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}시간 전`;
    return `${Math.floor(diffMinutes / 1440)}일 전`;
  };

  if (isLoading && !customers.length) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="h-full">
      {/* POS 스타일 - 태블릿에서 분할 레이아웃 */}
      <div className="flex flex-col tablet-lg:flex-row gap-6 h-full">
        {/* 왼쪽: 고객 검색 및 목록 */}
        <div className="flex-1 tablet-lg:flex-[3] space-y-4">
          {/* 총 예치금 - 컴팩트 버전 */}
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-primary-500 to-primary-600 rounded-xl text-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                <Wallet className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-primary-100 text-xs">총 예치금</p>
                <p className="text-xl font-bold">
                  {formatCurrency(summary?.total_balance || 0)}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-primary-200 text-sm">
                {summary?.total_customers || 0}명
              </p>
            </div>
          </div>

          {/* 검색 영역 - POS 스타일 */}
          <div className="bg-white dark:bg-[#2d2420] rounded-xl p-4 shadow-pos-card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Search className="w-5 h-5 text-primary-500" />
                고객 검색
              </h3>
              <Button
                size="pos"
                onClick={() => setIsAddCustomerModalOpen(true)}
              >
                <UserPlus className="w-5 h-5 mr-2" />
                고객 등록
              </Button>
            </div>

            <div className="flex flex-col tablet:flex-row gap-4">
              {/* 전화번호 뒷자리 입력 */}
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                  전화번호 뒷자리
                </label>
                <Input
                  inputSize="pos"
                  type="text"
                  placeholder="뒷자리 4자리 입력"
                  value={phoneDigits}
                  readOnly
                  onClear={() => {
                    setPhoneDigits('');
                    if (searchTimeoutRef.current) {
                      clearTimeout(searchTimeoutRef.current);
                    }
                    searchCustomers('');
                  }}
                  className="text-center text-2xl font-bold tracking-widest"
                />
              </div>

              {/* 넘패드 */}
              <div className="tablet:w-64">
                <Numpad
                  value={phoneDigits}
                  onChange={handleNumpadChange}
                  maxLength={4}
                />
              </div>
            </div>
          </div>

          {/* 고객 목록 - POS 스타일 */}
          <div className="bg-white dark:bg-[#2d2420] rounded-xl p-4 shadow-pos-card flex-1 overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                {phoneDigits ? `검색 결과 (${filteredCustomers.length}명)` : `전체 고객 (${total}명)`}
                {isSearching && (
                  <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                )}
              </h3>
            </div>

            {isSearching && filteredCustomers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" />
                <p className="mt-4 text-gray-500 dark:text-gray-400">검색 중...</p>
              </div>
            ) : filteredCustomers.length === 0 ? (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                <Coffee className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-lg">
                  {phoneDigits ? '검색 결과가 없습니다.' : '등록된 고객이 없습니다.'}
                </p>
              </div>
            ) : (
              <div className={clsx(
                "space-y-3 max-h-[calc(100vh-500px)] overflow-y-auto transition-opacity duration-150",
                isSearching && "opacity-50"
              )} data-testid="search-results">
                {filteredCustomers.map((customer) => (
                  <CustomerCard
                    key={customer.id}
                    ref={(el) => {
                      if (el) {
                        customerCardRefs.current.set(customer.id, el);
                      } else {
                        customerCardRefs.current.delete(customer.id);
                      }
                    }}
                    customer={customer}
                    variant="pos"
                    selected={selectedCustomer?.id === customer.id}
                    onClick={() => handleCustomerSelect(customer)}
                  />
                ))}
              </div>
            )}

            {/* 페이지네이션 */}
            {!phoneDigits && totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 mt-4 pt-4 border-t border-gray-100 dark:border-primary-800/30">
                <Button
                  variant="outline"
                  size="pos"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  이전
                </Button>
                <span className="text-base font-medium text-gray-600 dark:text-gray-400 px-4">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="pos"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  다음
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* 오른쪽: 선택된 고객 및 액션 패널 */}
        <div className="tablet-lg:flex-[2] space-y-4">
          {/* 선택된 고객 정보 */}
          <div className="bg-white dark:bg-[#2d2420] rounded-xl p-5 shadow-pos-card" data-testid="customer-detail">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              선택된 고객
            </h3>

            {selectedCustomer ? (
              <div className="space-y-4">
                <div className="flex items-center gap-4 p-4 bg-primary-50 dark:bg-primary-900/20 rounded-xl">
                  <div className="w-16 h-16 rounded-full bg-primary-500 flex items-center justify-center">
                    <span className="text-2xl font-bold text-white">
                      {selectedCustomer.name.charAt(0)}
                    </span>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-2xl font-bold text-gray-900 dark:text-white">
                      {selectedCustomer.name}
                    </h4>
                    <p className="text-gray-500 dark:text-gray-400">
                      ***-****-{selectedCustomer.phone_suffix}
                    </p>
                  </div>
                </div>

                <div className="text-center py-4 border-2 border-dashed border-gray-200 dark:border-primary-800/30 rounded-xl">
                  <p className="text-sm text-gray-500 dark:text-gray-400">현재 잔액</p>
                  <p
                    data-testid="customer-balance"
                    className={clsx(
                      'text-4xl font-bold',
                      selectedCustomer.current_balance >= 0
                        ? 'text-primary-600 dark:text-primary-400'
                        : 'text-error-500'
                    )}
                  >
                    {formatCurrency(selectedCustomer.current_balance)}
                  </p>
                </div>

                {/* 액션 버튼 */}
                <div className="space-y-3">
                  <Button
                    variant="error"
                    size="pos-lg"
                    onClick={() => handleDeductClick(selectedCustomer)}
                    className="w-full"
                  >
                    <Minus className="w-6 h-6 mr-2" />
                    차감 (결제)
                  </Button>
                  <Button
                    variant="success"
                    size="pos"
                    onClick={() => handleChargeClick(selectedCustomer)}
                    className="w-full"
                  >
                    <Plus className="w-6 h-6 mr-2" />
                    충전
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-400 dark:text-gray-500">
                <Coffee className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p className="text-lg">고객을 선택해주세요</p>
                <p className="text-sm mt-1">전화번호 뒷자리로 검색하거나</p>
                <p className="text-sm">목록에서 선택하세요</p>
              </div>
            )}
          </div>

          {/* 최근 거래 */}
          <div className="bg-white dark:bg-[#2d2420] rounded-xl p-5 shadow-pos-card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary-500" />
                최근 거래
              </h3>
            </div>

            {recentTransactions.length === 0 ? (
              <p className="text-center py-6 text-gray-400 dark:text-gray-500">
                최근 거래가 없습니다
              </p>
            ) : (
              <div className="space-y-2">
                {recentTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-primary-900/10"
                  >
                    <div className="flex items-center gap-3">
                      <div className={clsx(
                        'w-8 h-8 rounded-full flex items-center justify-center',
                        tx.type === 'CHARGE'
                          ? 'bg-success-100 dark:bg-success-900/30'
                          : 'bg-error-100 dark:bg-error-900/30'
                      )}>
                        {tx.type === 'CHARGE' ? (
                          <Plus className="w-4 h-4 text-success-600" />
                        ) : (
                          <Minus className="w-4 h-4 text-error-600" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white text-sm">
                          {tx.customer_name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {formatTimeAgo(tx.created_at)}
                        </p>
                      </div>
                    </div>
                    <p className={clsx(
                      'font-bold',
                      tx.type === 'CHARGE'
                        ? 'text-success-600 dark:text-success-400'
                        : 'text-error-600 dark:text-error-400'
                    )}>
                      {tx.type === 'CHARGE' ? '+' : '-'}
                      {formatCurrency(tx.type === 'CHARGE' ? (tx.actual_payment || 0) + (tx.service_amount || 0) : tx.amount)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 충전 모달 */}
      {selectedCustomer && (
        <>
          <ChargeModal
            isOpen={isChargeModalOpen}
            onClose={() => {
              setIsChargeModalOpen(false);
            }}
            customerId={selectedCustomer.id}
            customerName={selectedCustomer.name}
            currentBalance={selectedCustomer.current_balance}
            onSuccess={handleTransactionSuccess}
            onOptimisticUpdate={handleOptimisticUpdate}
            onRollback={handleRollback}
          />
          <DeductModal
            isOpen={isDeductModalOpen}
            onClose={() => {
              setIsDeductModalOpen(false);
            }}
            customerId={selectedCustomer.id}
            customerName={selectedCustomer.name}
            currentBalance={selectedCustomer.current_balance}
            onSuccess={handleTransactionSuccess}
            onOptimisticUpdate={handleOptimisticUpdate}
            onRollback={handleRollback}
          />
        </>
      )}

      {/* 고객 추가 모달 - POS 스타일 */}
      <Modal
        isOpen={isAddCustomerModalOpen}
        onClose={() => {
          setIsAddCustomerModalOpen(false);
          setNewCustomerName('');
          setNewCustomerPhone('');
        }}
        title="새 고객 등록"
        size="md"
        data-testid="add-customer-modal"
      >
        <div className="space-y-5">
          <Input
            inputSize="pos"
            label="고객 이름"
            placeholder="홍길동"
            value={newCustomerName}
            onChange={(e) => setNewCustomerName(e.target.value)}
          />
          <Input
            inputSize="pos"
            label="연락처 뒷자리 (4자리)"
            placeholder="1234"
            maxLength={4}
            value={newCustomerPhone}
            onChange={(e) => setNewCustomerPhone(e.target.value.replace(/\D/g, ''))}
            required
          />
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              size="pos"
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
              size="pos-lg"
              onClick={handleAddCustomer}
              isLoading={isAddingCustomer}
              disabled={!newCustomerName.trim() || newCustomerPhone.length !== 4}
              className="flex-[2]"
            >
              등록하기
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
