import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { fetchStats } from '../../features/admin/adminApi';
import { getApiErrorMessage } from '../../lib/api-client';
import { ErrorState, LoadingState } from '../../components/StateViews';
import { Card, PageHeader } from '../../components/ui/Card';
import { StatCard } from '../../components/ui/StatCard';
import { ChartIcon, ClipboardCheckIcon, FileTextIcon, UsersIcon } from '../../components/ui/Icons';

const STATUS_COLORS = { pendingApproval: '#f59e0b', approved: '#10b981', rejected: '#ef4444' };

export function AdminStatsPage() {
  const { data, isLoading, error } = useQuery({ queryKey: ['admin-stats'], queryFn: fetchStats });

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message={getApiErrorMessage(error)} />;
  if (!data) return null;

  const questionChartData = [
    { name: 'Chờ duyệt', value: data.questionsByStatus.pendingApproval, key: 'pendingApproval' },
    { name: 'Đã duyệt', value: data.questionsByStatus.approved, key: 'approved' },
    { name: 'Bị từ chối', value: data.questionsByStatus.rejected, key: 'rejected' },
  ];

  const overviewData = [
    { name: 'Học sinh', value: data.totalStudents },
    { name: 'Môn học', value: data.totalSubjects },
    { name: 'Đề thi', value: data.totalExams },
    { name: 'Lượt làm bài', value: data.totalAttempts },
  ];

  return (
    <div>
      <PageHeader
        title="Thống kê hệ thống"
        subtitle="Tổng quan hoạt động EduPath theo thời gian thực"
        icon={<ChartIcon className="h-5 w-5" />}
      />

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Học sinh" value={data.totalStudents} icon={<UsersIcon className="h-6 w-6" />} accent="indigo" />
        <StatCard label="Môn học" value={data.totalSubjects} icon={<FileTextIcon className="h-6 w-6" />} accent="sky" />
        <StatCard label="Đề thi" value={data.totalExams} icon={<ClipboardCheckIcon className="h-6 w-6" />} accent="emerald" />
        <StatCard
          label="Lượt làm bài"
          value={data.totalAttempts}
          icon={<ChartIcon className="h-6 w-6" />}
          accent="amber"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="p-5 lg:col-span-3">
          <h2 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-200">Tổng quan hệ thống</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={overviewData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-200 dark:text-slate-800" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="currentColor" className="text-slate-500" />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="currentColor" className="text-slate-500" />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 13 }}
                  cursor={{ fill: 'rgba(99,102,241,0.08)' }}
                />
                <Bar dataKey="value" fill="url(#barGradient)" radius={[8, 8, 0, 0]} />
                <defs>
                  <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" />
                    <stop offset="100%" stopColor="#8b5cf6" />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5 lg:col-span-2">
          <h2 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-200">Câu hỏi theo trạng thái</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={questionChartData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={3}
                >
                  {questionChartData.map((entry) => (
                    <Cell key={entry.key} fill={STATUS_COLORS[entry.key as keyof typeof STATUS_COLORS]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 13 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex flex-wrap justify-center gap-3 text-xs">
            {questionChartData.map((entry) => (
              <span key={entry.key} className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: STATUS_COLORS[entry.key as keyof typeof STATUS_COLORS] }}
                />
                {entry.name} ({entry.value})
              </span>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
