import { useState, useEffect, useCallback, useRef } from 'react';
import { getTransactions } from '../api/transactions';
import { Transaction, TransactionType } from '../types';

interface FilterState {
  search: string;
  type: TransactionType | '';
  startDate: string;
  endDate: string;
}

interface UseInfiniteTransactionsResult {
  transactions: Transaction[];
  totalCharge: number;
  totalDeduct: number;
  total: number;
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  filters: FilterState;
  setFilters: (filters: Partial<FilterState>) => void;
  loadMore: () => void;
  refresh: () => void;
  observerRef: (node: HTMLDivElement | null) => void;
}

const PAGE_SIZE = 20;

// 최근 7일 날짜 계산
const getDefaultDates = () => {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 6);

  return {
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0],
  };
};

export function useInfiniteTransactions(): UseInfiniteTransactionsResult {
  const defaultDates = getDefaultDates();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [totalCharge, setTotalCharge] = useState(0);
  const [totalDeduct, setTotalDeduct] = useState(0);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFiltersState] = useState<FilterState>({
    search: '',
    type: '',
    startDate: defaultDates.startDate,
    endDate: defaultDates.endDate,
  });

  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadingRef = useRef(false);

  const fetchTransactions = useCallback(
    async (pageNum: number, append: boolean = false) => {
      if (loadingRef.current) return;
      loadingRef.current = true;

      try {
        if (append) {
          setIsLoadingMore(true);
        } else {
          setIsLoading(true);
        }
        setError(null);

        const params: Parameters<typeof getTransactions>[0] = {
          page: pageNum,
          page_size: PAGE_SIZE,
        };

        if (filters.search) params.search = filters.search;
        if (filters.type) params.type = filters.type;
        if (filters.startDate) params.start_date = filters.startDate;
        if (filters.endDate) params.end_date = filters.endDate;

        const response = await getTransactions(params);

        if (append) {
          setTransactions((prev) => [...prev, ...response.transactions]);
        } else {
          setTransactions(response.transactions);
          setTotalCharge(response.total_charge);
          setTotalDeduct(response.total_deduct);
        }

        setTotal(response.total);
        setHasMore(pageNum * PAGE_SIZE < response.total);
      } catch (err: unknown) {
        const errorObj = err as { response?: { data?: { detail?: string } } };
        setError(errorObj.response?.data?.detail || '거래 내역을 불러오는데 실패했습니다');
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
        loadingRef.current = false;
      }
    },
    [filters]
  );

  // 필터 변경 시 초기화 후 재조회
  useEffect(() => {
    setPage(1);
    setTransactions([]);
    setHasMore(true);
    fetchTransactions(1, false);
  }, [filters.search, filters.type, filters.startDate, filters.endDate, fetchTransactions]);

  const loadMore = useCallback(() => {
    if (!hasMore || isLoadingMore || loadingRef.current) return;
    const nextPage = page + 1;
    setPage(nextPage);
    fetchTransactions(nextPage, true);
  }, [hasMore, isLoadingMore, page, fetchTransactions]);

  const refresh = useCallback(() => {
    setPage(1);
    setTransactions([]);
    setHasMore(true);
    fetchTransactions(1, false);
  }, [fetchTransactions]);

  const setFilters = useCallback((newFilters: Partial<FilterState>) => {
    setFiltersState((prev) => ({ ...prev, ...newFilters }));
  }, []);

  // Intersection Observer 콜백
  const setObserverRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }

      if (node) {
        observerRef.current = new IntersectionObserver(
          (entries) => {
            if (entries[0].isIntersecting && hasMore && !isLoadingMore && !isLoading) {
              loadMore();
            }
          },
          { threshold: 0.1 }
        );
        observerRef.current.observe(node);
      }
    },
    [hasMore, isLoadingMore, isLoading, loadMore]
  );

  return {
    transactions,
    totalCharge,
    totalDeduct,
    total,
    isLoading,
    isLoadingMore,
    hasMore,
    error,
    filters,
    setFilters,
    loadMore,
    refresh,
    observerRef: setObserverRef,
  };
}
