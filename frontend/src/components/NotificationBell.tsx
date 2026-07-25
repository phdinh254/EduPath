import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchMyNotifications, markNotificationsRead } from '../features/notifications/notificationsApi';
import { AwardIcon, BellIcon, RouteIcon, SparklesIcon } from './ui/Icons';

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ['my-notifications'],
    queryFn: fetchMyNotifications,
    refetchInterval: 60_000,
  });

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function handleToggle() {
    const next = !open;
    setOpen(next);
    if (next && (data?.unreadCount ?? 0) > 0) {
      await markNotificationsRead();
      queryClient.setQueryData(['my-notifications'], (old: typeof data) =>
        old ? { ...old, unreadCount: 0 } : old,
      );
    }
  }

  const notifications = data?.notifications ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={handleToggle}
        title="Thông báo"
        className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-slate-300 text-slate-500 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600 dark:border-slate-700 dark:text-slate-400 dark:hover:border-indigo-900 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-400"
      >
        <BellIcon className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-semibold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-200 bg-white p-2 shadow-lg shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
          <p className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Thông báo</p>
          {notifications.length === 0 ? (
            <p className="px-2 py-4 text-center text-sm text-slate-400">Chưa có thông báo nào.</p>
          ) : (
            <ul className="max-h-96 space-y-1 overflow-y-auto">
              {notifications.map((n) => (
                <li
                  key={n.id}
                  className="flex items-start gap-2.5 rounded-xl p-2.5 text-sm text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/60"
                >
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white">
                    {n.type === 'NEW_ADVICE' ? (
                      <SparklesIcon className="h-3.5 w-3.5" />
                    ) : n.type === 'STREAK_RISK' ? (
                      <AwardIcon className="h-3.5 w-3.5" />
                    ) : (
                      <RouteIcon className="h-3.5 w-3.5" />
                    )}
                  </span>
                  <div>
                    <p>{n.message}</p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {new Date(n.createdAt).toLocaleDateString('vi-VN')}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
