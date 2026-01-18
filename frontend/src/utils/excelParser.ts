import * as XLSX from 'xlsx';
import { CustomerImportRow } from '../types';

export interface ParsedCustomer extends CustomerImportRow {
  error?: string;
  rowNumber: number;
}

export interface ParseResult {
  customers: ParsedCustomer[];
  validCount: number;
  errorCount: number;
}

/**
 * Excel/CSV 파일을 파싱하여 고객 데이터를 추출합니다.
 *
 * 지원 형식: .xlsx, .xls, .csv
 * 필수 컬럼: 고객명(1열), 연락처뒷자리(2열), 잔액(3열)
 */
export function parseCustomerFile(file: File): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        // 첫 번째 시트 사용
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        // JSON으로 변환 (헤더 없이 배열로)
        const rows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
          header: 1,
          defval: '',
        });

        if (rows.length === 0) {
          resolve({ customers: [], validCount: 0, errorCount: 0 });
          return;
        }

        // 첫 번째 행이 헤더인지 확인
        const firstRow = rows[0] as string[];
        const hasHeader = isHeaderRow(firstRow);
        const startIndex = hasHeader ? 1 : 0;

        const customers: ParsedCustomer[] = [];
        let validCount = 0;
        let errorCount = 0;

        for (let i = startIndex; i < rows.length; i++) {
          const row = rows[i] as unknown[];
          if (!row || row.length === 0) continue;

          // 빈 행 건너뛰기
          if (!row[0] && !row[1] && !row[2]) continue;

          const customer = parseRow(row, i + 1); // 1-based row number
          customers.push(customer);

          if (customer.error) {
            errorCount++;
          } else {
            validCount++;
          }
        }

        resolve({ customers, validCount, errorCount });
      } catch (error) {
        reject(new Error('파일을 읽는 중 오류가 발생했습니다.'));
      }
    };

    reader.onerror = () => {
      reject(new Error('파일을 읽을 수 없습니다.'));
    };

    reader.readAsArrayBuffer(file);
  });
}

/**
 * 첫 번째 행이 헤더인지 확인
 */
function isHeaderRow(row: string[]): boolean {
  if (!row || row.length === 0) return false;

  const firstCell = String(row[0] || '').toLowerCase();
  const headerKeywords = ['고객', '이름', 'name', '성명', '고객명'];

  return headerKeywords.some((keyword) => firstCell.includes(keyword));
}

/**
 * 단일 행을 파싱
 */
function parseRow(row: unknown[], rowNumber: number): ParsedCustomer {
  const name = String(row[0] || '').trim();
  const phoneSuffix = extractPhoneSuffix(row[1]);
  const balance = parseBalance(row[2]);

  const customer: ParsedCustomer = {
    name,
    phone_suffix: phoneSuffix,
    balance,
    rowNumber,
  };

  // 유효성 검사
  const error = validateCustomer(customer);
  if (error) {
    customer.error = error;
  }

  return customer;
}

/**
 * 전화번호에서 뒷자리 4자리 추출
 */
function extractPhoneSuffix(value: unknown): string {
  if (value === null || value === undefined) return '';

  const str = String(value).trim();
  // 숫자만 추출
  const digits = str.replace(/\D/g, '');

  // 4자리 이상이면 뒤 4자리 사용
  if (digits.length >= 4) {
    return digits.slice(-4);
  }

  // 4자리 미만이면 그대로 반환 (검증에서 에러 처리)
  return digits;
}

/**
 * 잔액 파싱
 */
function parseBalance(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0;

  // 숫자인 경우
  if (typeof value === 'number') {
    return Math.max(0, Math.floor(value));
  }

  // 문자열인 경우 숫자만 추출
  const str = String(value).replace(/[,\s원]/g, '');
  const num = parseInt(str, 10);

  return isNaN(num) ? 0 : Math.max(0, num);
}

/**
 * 고객 데이터 유효성 검사
 */
function validateCustomer(customer: ParsedCustomer): string | undefined {
  if (!customer.name) {
    return '고객명이 비어있습니다';
  }

  if (customer.name.length > 50) {
    return '고객명이 너무 깁니다 (최대 50자)';
  }

  if (!customer.phone_suffix) {
    return '연락처 뒷자리가 비어있습니다';
  }

  if (!/^\d{4}$/.test(customer.phone_suffix)) {
    return '연락처 뒷자리는 4자리 숫자여야 합니다';
  }

  if (customer.balance < 0) {
    return '잔액은 0 이상이어야 합니다';
  }

  return undefined;
}

/**
 * 유효한 고객 데이터만 필터링
 */
export function getValidCustomers(customers: ParsedCustomer[]): CustomerImportRow[] {
  return customers
    .filter((c) => !c.error)
    .map(({ name, phone_suffix, balance }) => ({
      name,
      phone_suffix,
      balance,
    }));
}
