// Logo EduPath: mũ tốt nghiệp (Edu) + mũi tên đi lên (Path) lồng trong khối
// gradient indigo→violet — gợi "học tập" đi kèm "con đường tiến bộ đi lên".
export function LogoMark({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="EduPath"
    >
      <defs>
        <linearGradient id="epBg" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6366F1" />
          <stop offset="1" stopColor="#8B5CF6" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="13" fill="url(#epBg)" />
      {/* Mũ tốt nghiệp */}
      <path d="M24 13L40 20.5L24 28L8 20.5L24 13Z" fill="white" />
      <path
        d="M16 24.2V30.5C16 32 19.5 34.5 24 34.5C28.5 34.5 32 32 32 30.5V24.2L24 28L16 24.2Z"
        fill="white"
        fillOpacity="0.85"
      />
      <path d="M40 20.5V27.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="40" cy="29.3" r="1.6" fill="white" />
      {/* Huy hiệu mũi tên đi lên (Path) */}
      <circle cx="36.5" cy="36.5" r="8" fill="#F59E0B" stroke="white" strokeWidth="2" />
      <path
        d="M33 38.2L36.7 34.5L39.5 37.3L41.8 34"
        stroke="white"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path d="M38.2 34H41.8V37.6" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

export function Logo({
  size = 32,
  withWordmark = true,
  /** 'auto': đậm trên nền sáng/tối theo theme. 'light': luôn chữ trắng — dùng trên nền màu/gradient. */
  theme = 'auto',
  className = '',
}: {
  size?: number;
  withWordmark?: boolean;
  theme?: 'auto' | 'light';
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoMark size={size} />
      {withWordmark && (
        <span
          className={`whitespace-nowrap text-lg font-extrabold tracking-tight ${
            theme === 'light' ? 'text-white' : 'text-slate-900 dark:text-white'
          }`}
        >
          Edu
          <span
            className={
              theme === 'light'
                ? 'text-amber-300'
                : 'bg-gradient-to-r from-indigo-600 to-violet-500 bg-clip-text text-transparent'
            }
          >
            Path
          </span>
        </span>
      )}
    </span>
  );
}
