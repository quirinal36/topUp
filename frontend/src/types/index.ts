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
  customer_name?: string;
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
  total_charge: number;
  total_deduct: number;
}

// 구독 타입
export type SubscriptionStatus = 'TRIAL' | 'ACTIVE' | 'GRACE' | 'SUSPENDED' | 'CANCELLED';

export interface Subscription {
  shop_id: string;
  status: SubscriptionStatus;
  trial_start_date?: string;
  trial_end_date?: string;
  current_period_start?: string;
  current_period_end?: string;
  grace_period_end?: string;
  cancelled_at?: string;
  has_billing_key: boolean;
  days_remaining?: number;
  created_at: string;
  updated_at: string;
}

export interface PaymentHistory {
  id: string;
  shop_id: string;
  amount: number;
  status: 'SUCCESS' | 'FAILED' | 'PENDING' | 'REFUNDED';
  payment_key?: string;
  order_id: string;
  failure_reason?: string;
  created_at: string;
}

export interface SubscriptionConfig {
  monthly_price: number;
  trial_days: number;
  grace_period_days: number;
}
