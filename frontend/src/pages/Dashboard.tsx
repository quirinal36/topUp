import { useEffect, useState } from 'react';
import { Users, TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import Card from '../components/common/Card';
import { getDashboardSummary } from '../api/dashboard';
import { DashboardSummary } from '../types';

export default function Dashboard() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const data = await getDashboardSummary();
        setSummary(data);
      } catch (error) {
        console.error('Failed to fetch dashboard summary:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSummary();
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR').format(amount) + '원';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const stats = [
    {
      title: '오늘 충전',
      value: formatCurrency(summary?.today_total_charge || 0),
      icon: TrendingUp,
      color: 'text-success-500',
      bgColor: 'bg-success-50 dark:bg-success-900/20',
    },
    {
      title: '오늘 사용',
      value: formatCurrency(summary?.today_total_deduct || 0),
      icon: TrendingDown,
      color: 'text-primary-500',
      bgColor: 'bg-primary-50 dark:bg-primary-900/20',
    },
    {
      title: '전체 예치금',
      value: formatCurrency(summary?.total_balance || 0),
      icon: Wallet,
      color: 'text-warning-500',
      bgColor: 'bg-warning-50 dark:bg-warning-900/20',
    },
    {
      title: '총 고객',
      value: `${summary?.total_customers || 0}명`,
      icon: Users,
      color: 'text-secondary-600',
      bgColor: 'bg-secondary-100 dark:bg-secondary-900/20',
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-heading-2 text-gray-900 dark:text-white">대시보드</h1>

      {/* 통계 카드 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title}>
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-full ${stat.bgColor} flex items-center justify-center`}>
                  <Icon className={`w-6 h-6 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{stat.title}</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* 오늘의 요약 */}
      <Card>
        <h2 className="text-heading-3 text-gray-900 dark:text-white mb-4">오늘의 요약</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="p-4 bg-success-50 dark:bg-success-900/20 rounded-card">
            <p className="text-sm text-success-700 dark:text-success-400">오늘 충전 금액</p>
            <p className="text-2xl font-bold text-success-600">{formatCurrency(summary?.today_total_charge || 0)}</p>
          </div>
          <div className="p-4 bg-primary-50 dark:bg-primary-900/20 rounded-card">
            <p className="text-sm text-primary-700 dark:text-primary-400">오늘 사용 금액</p>
            <p className="text-2xl font-bold text-primary-600">{formatCurrency(summary?.today_total_deduct || 0)}</p>
          </div>
        </div>
      </Card>

      {/* 빠른 안내 */}
      <Card>
        <h2 className="text-heading-3 text-gray-900 dark:text-white mb-4">빠른 시작</h2>
        <div className="space-y-3 text-gray-600 dark:text-gray-400">
          <p>👤 <strong>고객 관리</strong>: 새로운 고객을 등록하고 관리하세요</p>
          <p>💰 <strong>충전</strong>: 고객의 선결제 금액을 충전하세요</p>
          <p>☕ <strong>사용</strong>: 고객이 서비스를 이용하면 잔액에서 차감하세요</p>
          <p>📊 <strong>통계</strong>: 매출 현황과 고객 분석을 확인하세요</p>
        </div>
      </Card>
    </div>
  );
}
