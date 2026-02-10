import { useState, useRef } from 'react';
import {
  Upload,
  Download,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle,
  Check,
} from 'lucide-react';
import Button from '../common/Button';
import { useToast } from '../../contexts/ToastContext';
import {
  exportCustomers,
  downloadCustomerTemplate,
  importCustomers,
} from '../../api/customers';
import {
  parseCustomerFile,
  getValidCustomers,
  ParsedCustomer,
} from '../../utils/excelParser';
import clsx from 'clsx';

export default function CustomerDataManagement() {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState('');
  const [parsedCustomers, setParsedCustomers] = useState<ParsedCustomer[]>([]);
  const [validCount, setValidCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const blob = await exportCustomers();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `customers_export_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('고객 데이터가 내보내기되었습니다');
    } catch {
      toast.error('내보내기에 실패했습니다');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const blob = await downloadCustomerTemplate();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'customer_import_template.xlsx';
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
    } catch {
      setError('파일을 읽는 중 오류가 발생했습니다');
      setParsedCustomers([]);
    } finally {
      setIsParsing(false);
    }

    e.target.value = '';
  };

  const handleImport = async () => {
    const validCustomers = getValidCustomers(parsedCustomers);

    if (validCustomers.length === 0 && parsedCustomers.length > 0) {
      setError('유효한 고객 데이터가 없습니다');
      return;
    }

    setIsImporting(true);
    setError('');

    try {
      const result = await importCustomers(validCustomers);

      if (result.errors.length > 0) {
        toast.warning(`${result.imported}명 등록, ${result.skipped}명 건너뜀`);
      } else if (result.skipped > 0) {
        toast.success(`${result.imported}명 등록 (${result.skipped}명 중복)`);
      } else {
        toast.success(`${result.imported}명의 고객이 등록되었습니다`);
      }

      // 초기화
      setFileName('');
      setParsedCustomers([]);
      setValidCount(0);
      setErrorCount(0);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || '등록에 실패했습니다';
      setError(message);
    } finally {
      setIsImporting(false);
    }
  };

  const handleCancelImport = () => {
    setFileName('');
    setParsedCustomers([]);
    setValidCount(0);
    setErrorCount(0);
    setError('');
  };

  return (
    <div className="space-y-4">
      {/* 내보내기 */}
      <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div className="flex items-center gap-3">
          <Download className="w-5 h-5 text-primary-500" />
          <div>
            <p className="font-medium text-gray-900 dark:text-white">
              데이터 내보내기
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              현재 등록된 모든 고객 데이터를 Excel로 다운로드
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          isLoading={isExporting}
        >
          <Download size={16} className="mr-1" />
          내보내기
        </Button>
      </div>

      {/* 가져오기 */}
      <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Upload className="w-5 h-5 text-primary-500" />
            <div>
              <p className="font-medium text-gray-900 dark:text-white">
                데이터 가져오기
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Excel/CSV 파일로 고객 데이터 일괄 등록
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
            <FileSpreadsheet size={16} className="mr-1" />
            템플릿
          </Button>
        </div>

        {/* 파일 업로드 영역 */}
        {!fileName ? (
          <div
            className={clsx(
              'border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors',
              'hover:border-primary-400 hover:bg-primary-50/50 dark:hover:bg-gray-700',
              'border-gray-300 dark:border-gray-600'
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
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500" />
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  파일 분석 중...
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <Upload className="text-gray-400" size={24} />
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  클릭하여 파일 선택 (.xlsx, .xls, .csv)
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {/* 파일 정보 */}
            <div className="flex items-center justify-between p-2 bg-white dark:bg-gray-900 rounded-lg border dark:border-gray-700">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="text-primary-500" size={20} />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {fileName}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="flex items-center gap-1 text-success-600">
                  <CheckCircle size={14} />
                  {validCount}명
                </span>
                {errorCount > 0 && (
                  <span className="flex items-center gap-1 text-error-600">
                    <AlertCircle size={14} />
                    {errorCount}건 오류
                  </span>
                )}
              </div>
            </div>

            {/* 미리보기 테이블 */}
            {parsedCustomers.length > 0 && (
              <div className="max-h-40 overflow-y-auto border rounded-lg dark:border-gray-700">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 dark:bg-gray-800 sticky top-0">
                    <tr>
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
                    {parsedCustomers.slice(0, 5).map((customer, index) => (
                      <tr
                        key={index}
                        className={clsx(
                          'border-t dark:border-gray-700',
                          customer.error && 'bg-error-50 dark:bg-error-900/20'
                        )}
                      >
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
                            <CheckCircle
                              className="inline text-success-500"
                              size={16}
                            />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsedCustomers.length > 5 && (
                  <div className="p-2 text-center text-xs text-gray-500 bg-gray-50 dark:bg-gray-800">
                    외 {parsedCustomers.length - 5}건...
                  </div>
                )}
              </div>
            )}

            {/* 액션 버튼 */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancelImport}
                className="flex-1"
              >
                취소
              </Button>
              <Button
                size="sm"
                onClick={handleImport}
                isLoading={isImporting}
                disabled={validCount === 0}
                className="flex-1"
              >
                <Check size={16} className="mr-1" />
                {validCount}명 등록
              </Button>
            </div>
          </div>
        )}
      </div>

      {error && (
        <p className="text-sm text-error-600 dark:text-error-400">{error}</p>
      )}
    </div>
  );
}
