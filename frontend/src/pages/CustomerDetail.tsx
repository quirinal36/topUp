import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Minus, Phone, Calendar, CreditCard } from 'lucide-react';
import Button from '../components/common/Button';
import Card from '../components/common/Card';
import ChargeModal from '../components/transaction/ChargeModal';
import DeductModal from '../components/transaction/DeductModal';
import TransactionList from '../components/transaction/TransactionList';
import { useCustomerStore } from '../stores/customerStore';
import { getTransactions } from '../api/transactions';
import { Transaction } from '../types';

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { selectedCustomer, fetchCustomer, isLoading } = useCustomerStore();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isChargeModalOpen, setIsChargeModalOpen] = useState(false);
  const [isDeductModalOpen, setIsDeductModalOpen] = useState(false);

  useEffect(() => {
    if (id) {
      fetchCustomer(id);
      loadTransactions(id);
    }
  }, [id, fetchCustomer]);

  const loadTransactions = async (customerId: string) => {
    try {
      const response = await getTransactions({ customer_id: customerId, page_size: 50 });
      setTransactions(response.transactions);
    } catch (error) {
      console.error('Failed to load transactions:', error);
    }
  };

  const handleTransactionSuccess = () => {
    if (id) {
      fetchCustomer(id);
      loadTransactions(id);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR').format(amount) + '원';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (isLoading || !selectedCustomer) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/customers')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-heading-2 text-gray-900 dark:text-white">
          {selectedCustomer.name}
        </h1>
      </div>

      {/* 고객 정보 카드 */}
      <Card>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <Phone className="w-4 h-4" /> 연락처
            </p>
            <p className="font-medium text-gray-900 dark:text-white">
              ***-****-{selectedCustomer.phone_suffix}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <Calendar className="w-4 h-4" /> 등록일
            </p>
            <p className="font-medium text-gray-900 dark:text-white">
              {formatDate(selectedCustomer.created_at)}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">총 충전액</p>
            <p className="font-medium text-success-600">
              {formatCurrency(selectedCustomer.total_charged)}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">총 사용액</p>
            <p className="font-medium text-primary-600">
              {formatCurrency(selectedCustomer.total_used)}
            </p>
          </div>
        </div>
      </Card>

      {/* 잔액 및 액션 버튼 */}
      <Card>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-center sm:text-left">
            <p className="text-sm text-gray-500 dark:text-gray-400">현재 잔액</p>
            <p className={`text-3xl font-bold ${selectedCustomer.current_balance >= 0 ? 'text-primary-600' : 'text-error-500'}`}>
              {formatCurrency(selectedCustomer.current_balance)}
            </p>
          </div>

          <div className="flex gap-3">
            <Button
              variant="success"
              size="lg"
              onClick={() => setIsChargeModalOpen(true)}
            >
              <Plus className="w-5 h-5 mr-2" />
              충전
            </Button>
            <Button
              size="lg"
              onClick={() => setIsDeductModalOpen(true)}
            >
              <Minus className="w-5 h-5 mr-2" />
              사용
            </Button>
          </div>
        </div>
      </Card>

      {/* 거래 내역 */}
      <div>
        <h2 className="text-heading-3 text-gray-900 dark:text-white mb-4">
          거래 내역 ({selectedCustomer.transaction_count}건)
        </h2>
        <TransactionList transactions={transactions} />
      </div>

      {/* 모달 */}
      <ChargeModal
        isOpen={isChargeModalOpen}
        onClose={() => setIsChargeModalOpen(false)}
        customerId={selectedCustomer.id}
        customerName={selectedCustomer.name}
        onSuccess={handleTransactionSuccess}
      />

      <DeductModal
        isOpen={isDeductModalOpen}
        onClose={() => setIsDeductModalOpen(false)}
        customerId={selectedCustomer.id}
        customerName={selectedCustomer.name}
        currentBalance={selectedCustomer.current_balance}
        onSuccess={handleTransactionSuccess}
      />
    </div>
  );
}
