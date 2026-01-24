import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Wallet } from 'lucide-react';
import Card from '../components/common/Card';
import { getPeriodAnalytics, getTopCustomers, getPaymentMethodStats, getDashboardSummary } from '../api/dashboard';
import { AnalyticsPeriod, TopCustomer, PaymentMethodStats, DashboardSummary } from '../types';

export default function Analytics() {
  const [periodData, setPeriodData] = useState<AnalyticsPeriod[]>([]);
  const [topCustomers, setTopCustomers] = useState<TopCustomer[]>([]);
  const [paymentStats, setPaymentStats] = useState<PaymentMethodStats[]>([]);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [period, customers, payments, summaryData] = await Promise.all([
          getPeriodAnalytics({ period_type: 'daily' }),
          getTopCustomers(5),
          getPaymentMethodStats(),
          getDashboardSummary(),
        ]);
        setPeriodData(period);
        setTopCustomers(customers);
        setPaymentStats(payments);
        setSummary(summaryData);
      } catch (error) {
        console.error('Failed to fetch analytics:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR').format(amount);
  };

  const COLORS = ['#a6714f', '#d4ba8c', '#22c55e', '#f59e0b'];

  const paymentMethodLabels: Record<string, string> = {
    CARD: '카드',
    CASH: '현금',
    TRANSFER: '이체',
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-heading-2 text-gray-900 dark:text-white">통계 분석</h1>

      {/* 총 예치금 */}
      <div className="flex items-center justify-between p-4 bg-gradient-to-r from-primary-500 to-primary-600 rounded-xl text-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
            <Wallet className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-primary-100 text-xs">총 예치금</p>
            <p className="text-xl font-bold">
              {formatCurrency(summary?.total_balance || 0)}원
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-primary-200 text-sm">
            전체 고객 {summary?.total_customers || 0}명
          </p>
        </div>
      </div>

      {/* 기간별 매출 차트 */}
      <Card>
        <h2 className="text-heading-3 text-gray-900 dark:text-white mb-4">일별 매출 현황</h2>
        <div className="h-64">
          {periodData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={periodData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(value) => `${formatCurrency(value)}`} />
                <Tooltip
                  formatter={(value: number) => `${formatCurrency(value)}원`}
                  labelFormatter={(label) => `날짜: ${label}`}
                />
                <Bar dataKey="charge_amount" fill="#22c55e" name="충전" />
                <Bar dataKey="deduct_amount" fill="#a6714f" name="사용" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              데이터가 없습니다
            </div>
          )}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* 상위 충전 고객 */}
        <Card>
          <h2 className="text-heading-3 text-gray-900 dark:text-white mb-4">상위 충전 고객</h2>
          {topCustomers.length > 0 ? (
            <div className="space-y-3">
              {topCustomers.map((customer, index) => (
                <div
                  key={customer.customer_id}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-primary-900/10 rounded-button"
                >
                  <div className="flex items-center gap-3">
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                      ${index === 0 ? 'bg-yellow-100 text-yellow-700' :
                        index === 1 ? 'bg-gray-200 text-gray-700' :
                        index === 2 ? 'bg-orange-100 text-orange-700' :
                        'bg-gray-100 text-gray-600'}`}
                    >
                      {index + 1}
                    </span>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{customer.name}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        방문 {customer.visit_count}회
                      </p>
                    </div>
                  </div>
                  <p className="font-bold text-primary-600 dark:text-primary-400">
                    {formatCurrency(customer.total_charged)}원
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-500 py-4">데이터가 없습니다</p>
          )}
        </Card>

        {/* 결제 수단별 현황 */}
        <Card>
          <h2 className="text-heading-3 text-gray-900 dark:text-white mb-4">결제 수단별 현황</h2>
          {paymentStats.length > 0 ? (
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="w-48 h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={paymentStats}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={5}
                      dataKey="amount"
                    >
                      {paymentStats.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => `${formatCurrency(value)}원`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-2">
                {paymentStats.map((stat, index) => (
                  <div key={stat.method} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="text-gray-600 dark:text-gray-400">
                        {paymentMethodLabels[stat.method] || stat.method}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="font-medium text-gray-900 dark:text-white">
                        {stat.percentage}%
                      </span>
                      <span className="text-sm text-gray-500 ml-2">
                        ({stat.count}건)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-center text-gray-500 py-4">데이터가 없습니다</p>
          )}
        </Card>
      </div>
    </div>
  );
}
