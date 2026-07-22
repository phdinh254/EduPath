import { googleAuthUrl } from '../features/auth/authApi';

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l6-6C34.5 5.1 29.5 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21 21-9.4 21-21c0-1.4-.1-2.8-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.8 1.1 8 3l6-6C34.5 5.1 29.5 3 24 3 16.3 3 9.7 7.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 45c5.4 0 10.3-2.1 14-5.4l-6.5-5.5c-2 1.4-4.6 2.4-7.5 2.4-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.6 40.6 16.3 45 24 45z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.6l6.5 5.5C41.4 36 44 30.5 44 24c0-1.4-.1-2.8-.4-3.5z"
      />
    </svg>
  );
}

export function GoogleButton({ label }: { label: string }) {
  return (
    <a
      href={googleAuthUrl()}
      className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
    >
      <GoogleIcon />
      {label}
    </a>
  );
}
