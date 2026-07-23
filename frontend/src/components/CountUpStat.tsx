import { useEffect, useRef, useState } from 'react';

function useCountUp(target: number, active: boolean, duration = 1400) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!active || target === 0) {
      if (target === 0) setValue(0);
      return;
    }
    let raf: number;
    const start = performance.now();
    function tick(now: number) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, target, duration]);

  return value;
}

// Tách phần số ở đầu chuỗi (vd. "24/7" -> 24 + "/7", "0s" -> 0 + "s") để chỉ
// hiệu ứng đếm phần số, giữ nguyên hậu tố.
function splitLeadingNumber(raw: string) {
  const match = raw.match(/^(\d+)(.*)$/);
  if (!match) return { target: null, suffix: raw };
  return { target: Number(match[1]), suffix: match[2] };
}

export function CountUpStat({ value, active }: { value: string; active: boolean }) {
  const { target, suffix } = splitLeadingNumber(value);
  const animated = useCountUp(target ?? 0, active && target !== null);

  if (target === null) return <>{value}</>;
  return (
    <>
      {animated}
      {suffix}
    </>
  );
}

export function useInViewOnce<T extends Element>() {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, inView };
}
