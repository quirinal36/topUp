import { useState } from 'react';
import CustomerSearch from '../components/customer/CustomerSearch';
import CustomerList from '../components/customer/CustomerList';
import Modal from '../components/common/Modal';
import Input from '../components/common/Input';
import Button from '../components/common/Button';
import { useCustomerStore } from '../stores/customerStore';

export default function Customers() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { createCustomer } = useCustomerStore();

  const handleAddCustomer = async () => {
    if (!newName.trim()) {
      setError('이름을 입력해주세요');
      return;
    }
    if (!newPhone || newPhone.length !== 4 || !/^\d{4}$/.test(newPhone)) {
      setError('연락처 뒷자리 4자리를 입력해주세요');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await createCustomer(newName.trim(), newPhone);
      handleCloseModal();
    } catch (err: any) {
      setError(err.response?.data?.detail || '고객 등록에 실패했습니다');
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
      <h1 className="text-heading-2 text-gray-900 dark:text-white">고객 관리</h1>

      <CustomerSearch onAddClick={() => setIsAddModalOpen(true)} />
      <CustomerList />

      {/* 고객 등록 모달 */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={handleCloseModal}
        title="신규 고객 등록"
      >
        <div className="space-y-4">
          <Input
            label="고객 이름"
            placeholder="홍길동"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <Input
            label="연락처 뒷자리"
            placeholder="1234"
            maxLength={4}
            value={newPhone}
            onChange={(e) => setNewPhone(e.target.value.replace(/\D/g, ''))}
          />

          {error && <p className="text-error-500 text-sm">{error}</p>}

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={handleCloseModal} className="flex-1">
              취소
            </Button>
            <Button onClick={handleAddCustomer} isLoading={isSubmitting} className="flex-1">
              등록하기
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
