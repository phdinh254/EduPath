import { useQuery } from '@tanstack/react-query';
import { fetchMyBadges } from '../../../features/gamification/gamificationApi';
import { Card } from '../../../components/ui/Card';
import { AwardIcon } from '../../../components/ui/Icons';

export function BadgesGrid() {
  const badgesQuery = useQuery({ queryKey: ['my-badges'], queryFn: fetchMyBadges });
  if (!badgesQuery.data || badgesQuery.data.length === 0) return null;

  return (
    <div className="mb-10">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
        <AwardIcon className="h-5 w-5 text-indigo-500" />
        Huy hiệu
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {badgesQuery.data.map((badge) => (
          <Card
            key={badge.id}
            className={`p-4 text-center transition ${badge.earned ? '' : 'opacity-40 grayscale'}`}
          >
            <span className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-lg">
              🏅
            </span>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{badge.name}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{badge.description}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
