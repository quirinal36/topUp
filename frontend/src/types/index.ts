// 고객 타입
export interface Customer {
  id: string;
  name: string;
  phone_suffix: string;
  current_balance: number;
  created_at: string;
}

export interface CustomerDetail extends Customer {
  total_charged: number;
  total_used: number;
  transaction_count: number;
}

// 거래 타입
export type TransactionType = 'CHARGE' | 'DEDUCT' | 'CANCEL';
export type PaymentMethod = 'CARD' | 'CASH' | 'TRANSFER';

export interface Transaction {
  id: string;
  customer_id: string;
  type: TransactionType;
  amount: number;
  actual_payment?: number;
  service_amount?: number;
  payment_method?: PaymentMethod;
  note?: string;
  created_at: string;
}

// 인증 타입
export interface AuthState {
  isAuthenticated: boolean;
  shopId: string | null;
  shopName: string | null;
  token: string | null;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  shop_id: string;
  is_new: boolean;
}

// 대시보드 타입
export interface DashboardSummary {
  today_total_charge: number;
  today_total_deduct: number;
  total_balance: number;
  total_customers: number;
}

export interface AnalyticsPeriod {
  period: string;
  charge_amount: number;
  deduct_amount: number;
  transaction_count: number;
}

export interface TopCustomer {
  customer_id: string;
  name: string;
  total_charged: number;
  visit_count: number;
}

export interface PaymentMethodStats {
  method: PaymentMethod;
  count: number;
  amount: number;
  percentage: number;
}

// API 응답 타입
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface CustomerListResponse {
  customers: Customer[];
  total: number;
  page: number;
  page_size: number;
}

export interface TransactionListResponse {
  transactions: Transaction[];
  total: number;
  page: number;
  page_size: number;
}
