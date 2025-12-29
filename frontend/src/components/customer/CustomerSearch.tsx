import { useState, useEffect } from 'react';
import { Search, UserPlus } from 'lucide-react';
import Input from '../common/Input';
import Button from '../common/Button';
import { useCustomerStore } from '../../stores/customerStore';

interface CustomerSearchProps {
  onAddClick: () => void;
}

export default function CustomerSearch({ onAddClick }: CustomerSearchProps) {
  const [inputValue, setInputValue] = useState('');
  const { setSearchQuery, fetchCustomers } = useCustomerStore();

  // 디바운스 검색
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(inputValue);
      fetchCustomers(inputValue);
    }, 300);

    return () => clearTimeout(timer);
  }, [inputValue, setSearchQuery, fetchCustomers]);

  return (
    <div className="flex flex-col sm:flex-row gap-3 mb-4">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <Input
          type="text"
          placeholder="이름 또는 연락처로 검색..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          className="pl-10"
        />
      </div>
      <Button onClick={onAddClick} className="whitespace-nowrap">
        <UserPlus className="w-5 h-5 mr-2" />
        고객 등록
      </Button>
    </div>
  );
}
