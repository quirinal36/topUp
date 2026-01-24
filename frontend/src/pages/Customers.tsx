import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, UserPlus, ArrowUpDown, BookText } from 'lucide-react';
import { clsx } from 'clsx';
import Modal from '../components/common/Modal';
import Input from '../components/common/Input';
import Button from '../components/common/Button';
import CustomerCard from '../components/customer/CustomerCard';
import Numpad from '../components/pos/Numpad';
import { useCustomerStore } from '../stores/customerStore';
import { useToast } from '../contexts/ToastContext';
import { audioFeedback } from '../utils/audioFeedback';

export default function Customers() {
  const navigate = useNavigate();
  const toast = useToast();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [phoneDigits, setPhoneDigits] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    customers,
    isLoading,
    page,
    total,
    pageSize,
    sortBy,
    sortOrder,
    fetchCustomers,
    createCustomer,
    setSortBy,
    setSortOrder,
  } = useCustomerStore();

  // 초기 로드
  useEffect(() => {
    fetchCustomers('');
    audioFeedback.init();
  }, []);

  // 정렬 변경 시 조회
  useEffect(() => {
    fetchCustomers();
  }, [sortBy, sortOrder]);

  // 서버 검색 사용으로 클라이언트 필터링 제거 - customers를 직접 사용
  const filteredCustomers = customers;

  const totalPages = Math.ceil(total / pageSize);

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
    searchTimeoutRef.current = setTimeout(async () => {
      await fetchCustomers(value, 1);
      setIsSearching(false);
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

  const handleSortChange = (newSortBy: string) => {
    if (sortBy === newSortBy) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(newSortBy);
      setSortOrder('asc');
    }
    audioFeedback.playTap();
  };

  const handlePageChange = (newPage: number) => {
    fetchCustomers(undefined, newPage);
  };

  const handleAddCustomer = async () => {
    if (!newName.trim()) {
      setError('이름을 입력해주세요');
      audioFeedback.playError();
      return;
    }
    if (!newPhone || newPhone.length !== 4 || !/^\d{4}$/.test(newPhone)) {
      setError('연락처 뒷자리 4자리를 입력해주세요');
      audioFeedback.playError();
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const customerName = newName.trim();
      await createCustomer(customerName, newPhone);
      audioFeedback.playSuccess();
      toast.success(`${customerName} 고객이 등록되었습니다`);
      handleCloseModal();
    } catch (err: any) {
      audioFeedback.playError();
      const errorMsg = err.response?.data?.detail || '고객 등록에 실패했습니다';
      toast.error(errorMsg);
      setError(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseModal = () => {
    setIsAddModalOpen(false);
    setNewName('');
    setNewPhone('');
    setError('');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-heading-2 text-gray-900 dark:text-white">고객 관리</h1>
        <Button
          size="pos"
          onClick={() => setIsAddModalOpen(true)}
        >
          <UserPlus className="w-5 h-5 mr-2" />
          고객 등록
        </Button>
      </div>

      {/* POS 스타일 검색 영역 */}
      <div className="bg-white dark:bg-[#2d2420] rounded-xl p-5 shadow-pos-card">
        <div className="flex items-center gap-2 mb-4">
          <Search className="w-5 h-5 text-primary-500" />
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">고객 검색</h3>
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
              onClear={() => setPhoneDigits('')}
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

        {/* 정렬 옵션 */}
        <div className="flex items-center gap-3 mt-4 pt-4 border-t border-gray-100 dark:border-primary-800/30">
          <ArrowUpDown className="w-4 h-4 text-gray-500" />
          <span className="text-sm text-gray-500 dark:text-gray-400">정렬:</span>
          <div className="flex gap-2">
            {[
              { key: 'name', label: '이름' },
              { key: 'created_at', label: '등록일' },
              { key: 'current_balance', label: '잔액' },
            ].map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => handleSortChange(key)}
                className={clsx(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150',
                  'active:scale-[0.98]',
                  sortBy === key
                    ? 'bg-primary-500 text-white shadow-pos-button'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-primary-900/30 dark:text-gray-400 dark:hover:bg-primary-800/50'
                )}
              >
                {label} {sortBy === key && (sortOrder === 'asc' ? '↑' : '↓')}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 고객 목록 - POS 스타일 */}
      <div className="bg-white dark:bg-[#2d2420] rounded-xl p-5 shadow-pos-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            {phoneDigits ? `검색 결과 (${filteredCustomers.length}명)` : `전체 고객 (${total}명)`}
            {isSearching && (
              <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
            )}
          </h3>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="animate-spin w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full" />
            <p className="mt-4 text-gray-500 dark:text-gray-400">
              고객 목록을 불러오는 중...
            </p>
          </div>
        ) : isSearching && filteredCustomers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" />
            <p className="mt-4 text-gray-500 dark:text-gray-400">검색 중...</p>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <BookText className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-lg">
              {phoneDigits ? '검색 결과가 없습니다.' : '등록된 고객이 없습니다.'}
            </p>
            {!phoneDigits && (
              <p className="text-sm mt-1">새로운 고객을 등록해주세요.</p>
            )}
          </div>
        ) : (
          <div className={clsx(
            "grid gap-3 tablet:grid-cols-2 tablet-lg:grid-cols-3 transition-opacity duration-150",
            isSearching && "opacity-50"
          )}>
            {filteredCustomers.map((customer) => (
              <CustomerCard
                key={customer.id}
                customer={customer}
                variant="pos"
                onClick={() => navigate(`/customers/${customer.id}`)}
              />
            ))}
          </div>
        )}

        {/* 페이지네이션 */}
        {!phoneDigits && totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-6 pt-4 border-t border-gray-100 dark:border-primary-800/30">
            <Button
              variant="outline"
              size="pos"
              onClick={() => handlePageChange(page - 1)}
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
              onClick={() => handlePageChange(page + 1)}
              disabled={page >= totalPages}
            >
              다음
            </Button>
          </div>
        )}
      </div>

      {/* 고객 등록 모달 - POS 스타일 */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={handleCloseModal}
        title="신규 고객 등록"
        size="md"
      >
        <div className="space-y-5">
          <Input
            inputSize="pos"
            label="고객 이름"
            placeholder="홍길동"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <Input
            inputSize="pos"
            label="연락처 뒷자리 (4자리)"
            placeholder="1234"
            maxLength={4}
            value={newPhone}
            onChange={(e) => setNewPhone(e.target.value.replace(/\D/g, ''))}
            required
          />

          {error && <p className="text-error-500 text-base font-medium">{error}</p>}

          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              size="pos"
              onClick={handleCloseModal}
              className="flex-1"
            >
              취소
            </Button>
            <Button
              size="pos-lg"
              onClick={handleAddCustomer}
              isLoading={isSubmitting}
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
