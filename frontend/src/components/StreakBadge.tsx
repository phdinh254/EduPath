import { useQuery } from '@tanstack/react-query';
import { fetchMyStreak } from '../features/gamification/gamificationApi';

// Hiển thị ở header, luôn thấy được (không chỉ trên trang lộ trình) để nhắc
// nhở duy trì thói quen ôn tập hằng ngày — cốt lõi của gamification.
export function StreakBadge() {
  const { data } = useQuery({
    queryKey: ['my-streak'],
    queryFn: fetchMyStreak,
    refetchInterval: 60_000,
  });

  if (!data || data.currentStreak === 0) return null;

  return (
    <span
      title={
        data.isActiveToday
          ? `Bạn đã ôn tập hôm nay — giữ vững chuỗi ${data.currentStreak} ngày!`
          : `Chuỗi ${data.currentStreak} ngày — làm 1 đề hôm nay để không bị đứt chuỗi!`
      }
      className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-sm font-semibold transition ${
        data.isActiveToday
          ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-500/10 dark:text-amber-400'
          : 'border-slate-300 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400'
      }`}
    >
      🔥 {data.currentStreak}
    </span>
  );
}
