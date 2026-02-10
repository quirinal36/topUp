import { useState, useRef } from 'react';
import {
  Users,
  Upload,
  Download,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle,
  ArrowLeft,
  Check,
} from 'lucide-react';
import Button from '../../components/common/Button';
import Card from '../../components/common/Card';
import { useOnboardingStore } from '../../stores/onboardingStore';
import { importCustomers, downloadTemplate } from '../../api/onboarding';
import {
  parseCustomerFile,
  getValidCustomers,
  ParsedCustomer,
} from '../../utils/excelParser';
import { useToast } from '../../contexts/ToastContext';
import clsx from 'clsx';

interface OnboardingStep3Props {
  onBack: () => void;
  onComplete: () => void;
}

export default function OnboardingStep3({ onBack, onComplete }: OnboardingStep3Props) {
  const toast = useToast();
  const { setStep3Data } = useOnboardingStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState('');
  const [parsedCustomers, setParsedCustomers] = useState<ParsedCustomer[]>([]);
  const [validCount, setValidCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);

  const handleDownloadTemplate = async () => {
    try {
      const blob = await downloadTemplate();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'customer_import_template.csv';
      a.click();
      URL.revokeObjectURL(url);
      toast.success('템플릿이 다운로드되었습니다');
    } catch {
      toast.error('템플릿 다운로드에 실패했습니다');
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 파일 확장자 확인
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(ext || '')) {
      setError('지원하지 않는 파일 형식입니다 (.xlsx, .xls, .csv만 가능)');
      return;
    }

    setFileName(file.name);
    setError('');
    setIsParsing(true);

    try {
      const result = await parseCustomerFile(file);
      setParsedCustomers(result.customers);
      setValidCount(result.validCount);
      setErrorCount(result.errorCount);

      if (result.customers.length === 0) {
        setError('파일에 데이터가 없습니다');
      }
    } catch (err) {
      setError('파일을 읽는 중 오류가 발생했습니다');
      setParsedCustomers([]);
    } finally {
      setIsParsing(false);
    }

    // 같은 파일을 다시 선택할 수 있도록 초기화
    e.target.value = '';
  };

  const handleSubmit = async () => {
    const validCustomers = getValidCustomers(parsedCustomers);

    if (validCustomers.length === 0 && parsedCustomers.length > 0) {
      setError('유효한 고객 데이터가 없습니다');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      if (validCustomers.length > 0) {
        const result = await importCustomers(validCustomers);
        setStep3Data(validCustomers);

        if (result.errors.length > 0) {
          toast.warning(
            `${result.imported}명 등록, ${result.skipped}명 건너뜀`
          );
        } else {
          toast.success(`${result.imported}명의 고객이 등록되었습니다`);
        }
      }

      onComplete();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || '등록에 실패했습니다';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = () => {
    setStep3Data([]);
    toast.info('고객 등록을 건너뛰었습니다');
    onComplete();
  };

  return (
    <Card className="p-6 sm:p-8">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-100 rounded-full mb-4">
          <Users className="w-8 h-8 text-primary-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          고객 데이터 가져오기
        </h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          기존 고객 데이터를 Excel 파일로 일괄 등록할 수 있습니다 (선택사항)
        </p>
      </div>

      {/* 템플릿 다운로드 */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="text-primary-500" size={20} />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              템플릿 파일
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
            <Download size={16} className="mr-1" />
            다운로드
          </Button>
        </div>
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          템플릿에 맞게 고객명, 연락처 뒷자리(4자리), 잔액을 입력해주세요
        </p>
      </div>

      {/* 파일 업로드 */}
      <div
        className={clsx(
          'border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors',
          'hover:border-primary-400 hover:bg-primary-50 dark:hover:bg-gray-800',
          fileName
            ? 'border-primary-400 bg-primary-50 dark:bg-gray-800'
            : 'border-gray-300 dark:border-gray-600'
        )}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleFileSelect}
          className="hidden"
        />

        {isParsing ? (
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              파일 분석 중...
            </p>
          </div>
        ) : fileName ? (
          <div className="flex flex-col items-center">
            <FileSpreadsheet className="text-primary-500" size={32} />
            <p className="mt-2 font-medium text-gray-700 dark:text-gray-300">
              {fileName}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              클릭하여 다른 파일 선택
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <Upload className="text-gray-400" size={32} />
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              클릭하여 파일 선택 또는 드래그 앤 드롭
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              .xlsx, .xls, .csv 파일 지원
            </p>
          </div>
        )}
      </div>

      {/* 파싱 결과 */}
      {parsedCustomers.length > 0 && (
        <div className="mt-4 space-y-3">
          <div className="flex gap-4">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle className="text-success-500" size={16} />
              <span className="text-gray-700 dark:text-gray-300">
                유효: {validCount}명
              </span>
            </div>
            {errorCount > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <AlertCircle className="text-error-500" size={16} />
                <span className="text-error-600 dark:text-error-400">
                  오류: {errorCount}건
                </span>
              </div>
            )}
          </div>

          {/* 미리보기 테이블 */}
          <div className="max-h-48 overflow-y-auto border rounded-lg dark:border-gray-700">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 dark:bg-gray-800 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">
                    #
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">
                    고객명
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">
                    연락처
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600 dark:text-gray-400">
                    잔액
                  </th>
                  <th className="px-3 py-2 text-center font-medium text-gray-600 dark:text-gray-400">
                    상태
                  </th>
                </tr>
              </thead>
              <tbody>
                {parsedCustomers.slice(0, 10).map((customer, index) => (
                  <tr
                    key={index}
                    className={clsx(
                      'border-t dark:border-gray-700',
                      customer.error && 'bg-error-50 dark:bg-error-900/20'
                    )}
                  >
                    <td className="px-3 py-2 text-gray-500 dark:text-gray-400">
                      {customer.rowNumber}
                    </td>
                    <td className="px-3 py-2 text-gray-900 dark:text-white">
                      {customer.name || '-'}
                    </td>
                    <td className="px-3 py-2 text-gray-700 dark:text-gray-300">
                      {customer.phone || '-'}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">
                      {customer.balance.toLocaleString()}원
                    </td>
                    <td className="px-3 py-2 text-center">
                      {customer.error ? (
                        <span className="text-xs text-error-600 dark:text-error-400">
                          {customer.error}
                        </span>
                      ) : (
                        <CheckCircle className="inline text-success-500" size={16} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {parsedCustomers.length > 10 && (
              <div className="p-2 text-center text-xs text-gray-500 bg-gray-50 dark:bg-gray-800">
                외 {parsedCustomers.length - 10}건...
              </div>
            )}
          </div>
        </div>
      )}

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
            완료
            <Check size={16} className="ml-1" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
