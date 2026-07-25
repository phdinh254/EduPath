import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchMyBadges } from '../features/gamification/gamificationApi';
import { useToast } from './ToastProvider';

const SEEN_BADGES_KEY = 'edupath-seen-badges';

function loadSeenBadgeIds(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_BADGES_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

// Huy hiệu không lưu thời điểm đạt được ở backend (tính lại mỗi lần gọi từ
// số liệu tích luỹ) — nên việc phát hiện "vừa đạt huy hiệu mới" để chúc mừng
// phải so sánh với danh sách đã thấy lưu cục bộ ở trình duyệt, cùng cách
// StudentExamAttemptPage lưu câu đánh dấu yêu thích theo localStorage.
export function BadgeEarnedWatcher() {
  const { showToast } = useToast();
  const { data } = useQuery({
    queryKey: ['my-badges'],
    queryFn: fetchMyBadges,
    refetchInterval: 60_000,
  });

  useEffect(() => {
    if (!data) return;
    const seen = loadSeenBadgeIds();
    const newlyEarned = data.filter((b) => b.earned && !seen.has(b.id));
    if (newlyEarned.length === 0) return;

    for (const badge of newlyEarned) {
      showToast(`🏅 Huy hiệu mới: ${badge.name} — ${badge.description}`, 'success');
      seen.add(badge.id);
    }
    localStorage.setItem(SEEN_BADGES_KEY, JSON.stringify([...seen]));
  }, [data, showToast]);

  return null;
}
