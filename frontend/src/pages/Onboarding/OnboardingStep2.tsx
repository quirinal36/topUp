import { useState } from 'react';
import { Coffee, Plus, Trash2, ArrowLeft, ArrowRight } from 'lucide-react';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Card from '../../components/common/Card';
import { useOnboardingStore } from '../../stores/onboardingStore';
import { updateStep2 } from '../../api/onboarding';
import { useToast } from '../../contexts/ToastContext';

interface OnboardingStep2Props {
  onBack: () => void;
  onNext: () => void;
}

export default function OnboardingStep2({ onBack, onNext }: OnboardingStep2Props) {
  const toast = useToast();
  const { menus, addMenu, updateMenu, removeMenu, setStep2Data } =
    useOnboardingStore();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handlePriceChange = (index: number, value: string) => {
    // 숫자만 추출
    const numValue = value.replace(/\D/g, '');
    updateMenu(index, 'price', numValue ? parseInt(numValue, 10) : 0);
  };

  const formatPrice = (price: number): string => {
    return price > 0 ? price.toLocaleString() : '';
  };

  const handleSubmit = async () => {
    // 유효한 메뉴만 필터링 (이름이 있는 것)
    const validMenus = menus.filter((m) => m.name.trim());

    // 유효성 검사
    for (const menu of validMenus) {
      if (menu.price < 0) {
        setError('가격은 0 이상이어야 합니다');
        return;
      }
    }

    setIsLoading(true);
    setError('');

    try {
      const result = await updateStep2(validMenus);
      setStep2Data(validMenus);

      if (validMenus.length > 0) {
        toast.success(`${result.count}개의 메뉴가 등록되었습니다`);
      } else {
        toast.info('메뉴 등록을 건너뛰었습니다');
      }
      onNext();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || '저장에 실패했습니다';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = () => {
    setStep2Data([]);
    toast.info('메뉴 등록을 건너뛰었습니다');
    onNext();
  };

  return (
    <Card className="p-6 sm:p-8">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-100 rounded-full mb-4">
          <Coffee className="w-8 h-8 text-primary-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          메뉴 등록
        </h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          판매하는 메뉴를 등록해주세요 (선택사항)
        </p>
      </div>

      <div className="space-y-3">
        {menus.map((menu, index) => (
          <div
            key={index}
            className="flex gap-2 items-start p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
          >
            <div className="flex-1">
              <Input
                placeholder="메뉴명"
                value={menu.name}
                onChange={(e) => updateMenu(index, 'name', e.target.value)}
                maxLength={100}
              />
            </div>
            <div className="w-32">
              <Input
                placeholder="가격"
                value={formatPrice(menu.price)}
                onChange={(e) => handlePriceChange(index, e.target.value)}
                className="text-right"
              />
            </div>
            <span className="self-center text-sm text-gray-500 dark:text-gray-400">
              원
            </span>
            {menus.length > 1 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeMenu(index)}
                className="self-center text-gray-400 hover:text-error-500"
              >
                <Trash2 size={18} />
              </Button>
            )}
          </div>
        ))}
      </div>

      <Button
        variant="outline"
        onClick={addMenu}
        className="w-full mt-4"
      >
        <Plus size={16} className="mr-1" />
        메뉴 추가
      </Button>

      {error && (
        <p className="mt-4 text-sm text-error-600 dark:text-error-400">{error}</p>
      )}

      <div className="mt-8 flex justify-between">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft size={16} className="mr-1" />
          이전
        </Button>

        <div className="flex gap-2">
          <Button variant="ghost" onClick={handleSkip}>
            건너뛰기
          </Button>
          <Button
            onClick={handleSubmit}
            isLoading={isLoading}
            className="min-w-[120px]"
          >
            다음
            <ArrowRight size={16} className="ml-1" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
