import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Minus, Phone, Calendar, Trash2, Edit2 } from 'lucide-react';
import Button from '../components/common/Button';
import Card from '../components/common/Card';
import Modal from '../components/common/Modal';
import Input from '../components/common/Input';
import ChargeModal from '../components/transaction/ChargeModal';
import DeductModal from '../components/transaction/DeductModal';
import TransactionList from '../components/transaction/TransactionList';
import PinVerifyModal from '../components/common/PinVerifyModal';
import { useCustomerStore } from '../stores/customerStore';
import { getTransactions } from '../api/transactions';
import { updateCustomer, deleteCustomer } from '../api/customers';
import { Transaction } from '../types';
import { usePinVerify } from '../hooks/usePinVerify';
import { useToast } from '../contexts/ToastContext';

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const { selectedCustomer, fetchCustomer, isLoading } = useCustomerStore();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isChargeModalOpen, setIsChargeModalOpen] = useState(false);
  const [isDeductModalOpen, setIsDeductModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editError, setEditError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { 
    isPinModalOpen, 
    closePinModal, 
    withPinVerification, 
    handlePinVerified 
  } = usePinVerify();
  const [pinAction, setPinAction] = useState<'edit' | 'delete' | null>(null);

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

  const handleEditClick = () => {
    if (!selectedCustomer) return;
    setEditName(selectedCustomer.name);
    setEditPhone(selectedCustomer.phone_suffix);
    setEditError('');
    setPinAction('edit');
    withPinVerification(() => {
      setIsEditModalOpen(true);
    });
  };

  const handleDeleteClick = () => {
    if (!selectedCustomer) return;
    if (selectedCustomer.current_balance !== 0) {
      toast.warning('잔액이 0원인 고객만 삭제할 수 있습니다');
      return;
    }
    setPinAction('delete');
    withPinVerification(() => {
      setIsDeleteConfirmOpen(true);
    });
  };

  const handleEditSubmit = async () => {
    if (!id) return;
    
    if (!editName.trim()) {
      setEditError('이름을 입력해주세요');
      return;
    }
    if (!editPhone || editPhone.length !== 4 || !/^\d{4}$/.test(editPhone)) {
      setEditError('연락처 뒷자리 4자리를 입력해주세요');
      return;
    }

    setIsSubmitting(true);
    setEditError('');

    try {
      await updateCustomer(id, { name: editName.trim(), phone_suffix: editPhone });
      toast.success('고객 정보가 수정되었습니다');
      fetchCustomer(id);
      setIsEditModalOpen(false);
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { detail?: string } } };
      const errorMsg = errorObj.response?.data?.detail || '수정에 실패했습니다';
      toast.error(errorMsg);
      setEditError(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!id || !selectedCustomer) return;

    setIsSubmitting(true);
    try {
      await deleteCustomer(id);
      toast.success(`${selectedCustomer.name} 고객이 삭제되었습니다`);
      navigate('/customers');
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { detail?: string } } };
      const errorMsg = errorObj.response?.data?.detail || '삭제에 실패했습니다';
      toast.error(errorMsg);
    } finally {
      setIsSubmitting(false);
      setIsDeleteConfirmOpen(false);
    }
  };

  const handlePinVerifiedAction = () => {
    handlePinVerified();
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/customers')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-heading-2 text-gray-900 dark:text-white">
            {selectedCustomer.name}
          </h1>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleEditClick}>
            <Edit2 className="w-4 h-4 mr-1" />
            수정
          </Button>
          <Button 
            variant="error" 
            size="sm" 
            onClick={handleDeleteClick}
            disabled={selectedCustomer.current_balance !== 0}
          >
            <Trash2 className="w-4 h-4 mr-1" />
            삭제
          </Button>
        </div>
      </div>

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

      <div>
        <h2 className="text-heading-3 text-gray-900 dark:text-white mb-4">
          거래 내역 ({selectedCustomer.transaction_count}건)
        </h2>
        <TransactionList 
          transactions={transactions} 
          onTransactionCancelled={handleTransactionSuccess}
        />
      </div>

      <ChargeModal
        isOpen={isChargeModalOpen}
        onClose={() => setIsChargeModalOpen(false)}
        customerId={selectedCustomer.id}
        customerName={selectedCustomer.name}
        currentBalance={selectedCustomer.current_balance}
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

      <Modal 
        isOpen={isEditModalOpen} 
        onClose={() => setIsEditModalOpen(false)} 
        title="고객 정보 수정"
      >
        <div className="space-y-4">
          <Input
            label="고객 이름"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
          />
          <Input
            label="연락처 뒷자리"
            maxLength={4}
            value={editPhone}
            onChange={(e) => setEditPhone(e.target.value.replace(/\D/g, ''))}
          />

          {editError && <p className="text-error-500 text-sm">{editError}</p>}

          <div className="flex gap-2 pt-2">
            <Button 
              variant="outline" 
              onClick={() => setIsEditModalOpen(false)} 
              className="flex-1"
            >
              취소
            </Button>
            <Button 
              onClick={handleEditSubmit} 
              isLoading={isSubmitting} 
              className="flex-1"
            >
              저장
            </Button>
          </div>
        </div>
      </Modal>

      <Modal 
        isOpen={isDeleteConfirmOpen} 
        onClose={() => setIsDeleteConfirmOpen(false)} 
        title="고객 삭제"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-600 dark:text-gray-400">
            <strong className="text-gray-900 dark:text-white">{selectedCustomer.name}</strong> 
            고객을 삭제하시겠습니까?
          </p>
          <p className="text-sm text-error-500">
            이 작업은 되돌릴 수 없습니다.
          </p>

          <div className="flex gap-2 pt-2">
            <Button 
              variant="outline" 
              onClick={() => setIsDeleteConfirmOpen(false)} 
              className="flex-1"
            >
              취소
            </Button>
            <Button 
              variant="error"
              onClick={handleDeleteConfirm} 
              isLoading={isSubmitting} 
              className="flex-1"
            >
              삭제
            </Button>
          </div>
        </div>
      </Modal>

      <PinVerifyModal
        isOpen={isPinModalOpen}
        onClose={closePinModal}
        onVerified={handlePinVerifiedAction}
        title={pinAction === 'delete' ? '고객 삭제 확인' : '고객 정보 수정'}
        description={
          pinAction === 'delete' 
            ? '고객을 삭제하려면 PIN을 입력해주세요.' 
            : '고객 정보를 수정하려면 PIN을 입력해주세요.'
        }
      />
    </div>
  );
}
