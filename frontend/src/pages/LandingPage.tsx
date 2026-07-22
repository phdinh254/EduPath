import { Link } from 'react-router-dom';
import { Logo } from '../components/Logo';

const FEATURES = [
  {
    icon: '⚡',
    title: 'Chấm điểm tức thời bằng AI',
    desc: 'Nộp bài là có điểm ngay — kể cả bài tự luận Ngữ văn. Không phải chờ đợi, không hồi hộp.',
  },
  {
    icon: '🎯',
    title: 'Chuẩn cấu trúc THPT 2025',
    desc: 'Trắc nghiệm nhiều lựa chọn, đúng/sai lũy tiến, trả lời ngắn — đúng 3 dạng câu đề thi thật.',
  },
  {
    icon: '🧭',
    title: 'Song song THPT & ĐGNL',
    desc: 'Vừa luyện thi tốt nghiệp, vừa luyện Đánh giá năng lực — một nền tảng, hai mục tiêu.',
  },
  {
    icon: '🧠',
    title: 'Lộ trình ôn tập cá nhân hoá',
    desc: 'AI phân tích điểm yếu theo từng chuyên đề và tự động đề xuất lộ trình ôn tập riêng cho bạn.',
  },
  {
    icon: '📚',
    title: 'Ngân hàng đề không giới hạn',
    desc: 'AI liên tục sinh đề mới, không lo học tủ, trúng tủ — luyện bao nhiêu cũng không hết đề.',
  },
  {
    icon: '🚀',
    title: 'Tự học, không cần lớp',
    desc: 'Không cần đăng ký lớp, không chờ giáo viên xếp lịch. Mở máy là thi được ngay.',
  },
];

const STEPS = [
  { n: '1', title: 'Tạo tài khoản', desc: 'Chưa đến 1 phút, chỉ cần email.' },
  { n: '2', title: 'Chọn đề muốn luyện', desc: 'THPT theo môn, hoặc ĐGNL đủ 3 phần thi.' },
  { n: '3', title: 'Làm bài như thi thật', desc: 'Tính giờ, giao diện gọn gàng, tập trung.' },
  { n: '4', title: 'Nhận điểm & lộ trình ngay', desc: 'Biết điểm tức thời, biết luôn phải ôn gì tiếp theo.' },
];

const STATS = [
  { value: '3', label: 'dạng câu trắc nghiệm chuẩn 2025' },
  { value: '2', label: 'kỳ thi: THPT & ĐGNL' },
  { value: '0s', label: 'thời gian chờ chấm điểm' },
  { value: '24/7', label: 'sẵn sàng luyện đề mọi lúc' },
];

export function LandingPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-white dark:bg-slate-950">
      {/* Nav */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/80 backdrop-blur dark:border-slate-800/80 dark:bg-slate-950/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
          <Logo size={28} />
          <nav className="flex items-center gap-1.5 sm:gap-3">
            <Link
              to="/login"
              className="whitespace-nowrap rounded-lg px-2.5 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
            >
              Đăng nhập
            </Link>
            <Link
              to="/register"
              className="whitespace-nowrap rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700 sm:px-4 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
            >
              Vào thi ngay
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[600px] bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgba(99,102,241,0.18),transparent)] dark:bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgba(99,102,241,0.28),transparent)]"
        />
        <div className="mx-auto flex max-w-4xl flex-col items-center px-6 pb-16 pt-16 text-center sm:pt-24">
          <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-4 py-1.5 text-xs font-semibold text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
            🔥 Điểm chưa như ý? Đừng để nó tiếp diễn ở kỳ thi thật
          </span>
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-6xl dark:text-white">
            Đang điểm thấp?
            <br />
            <span className="bg-gradient-to-r from-indigo-600 to-violet-500 bg-clip-text text-transparent">
              Ôn luyện ngay hôm nay.
            </span>
          </h1>
          <p className="mt-6 max-w-2xl text-base text-slate-600 sm:text-lg dark:text-slate-300">
            Mỗi ngày trì hoãn là một chuyên đề chưa kịp ôn. EduPath dùng AI ra đề không giới hạn, chấm điểm
            tức thời kể cả bài Văn, và chỉ thẳng chỗ bạn đang yếu — để điểm số lần sau thật sự khác.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link
              to="/register"
              className="rounded-xl bg-indigo-600 px-7 py-3.5 text-base font-semibold text-white shadow-lg shadow-indigo-600/30 transition hover:-translate-y-0.5 hover:bg-indigo-500 hover:shadow-xl hover:shadow-indigo-600/40"
            >
              Bắt đầu ôn thi miễn phí →
            </Link>
            <Link
              to="/login"
              className="rounded-xl border border-slate-300 px-7 py-3.5 text-base font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
            >
              Tôi đã có tài khoản
            </Link>
          </div>
          <p className="mt-4 text-xs text-slate-400 dark:text-slate-500">
            Không cần thẻ ngân hàng · Không cần mã lớp · Sẵn sàng làm bài trong 60 giây
          </p>
        </div>

        {/* Stats bar */}
        <div className="mx-auto max-w-5xl px-6">
          <div className="grid grid-cols-2 gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:grid-cols-4 dark:border-slate-800 dark:bg-slate-900">
            {STATS.map((s) => (
              <div key={s.label} className="text-center">
                <p className="text-2xl font-extrabold text-slate-900 sm:text-3xl dark:text-white">{s.value}</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <div className="mb-12 text-center">
          <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl dark:text-white">
            Vì sao học sinh chọn EduPath?
          </h2>
          <p className="mt-3 text-slate-500 dark:text-slate-400">
            Mọi thứ bạn cần để tự tin bước vào phòng thi — không cần ai nhắc, không cần chờ ai duyệt.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="group rounded-2xl border border-slate-200 bg-white p-6 transition hover:-translate-y-1 hover:border-indigo-300 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-700"
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-2xl dark:bg-indigo-950">
                {f.icon}
              </div>
              <h3 className="mb-2 font-semibold text-slate-900 dark:text-white">{f.title}</h3>
              <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-slate-200 bg-slate-50 py-24 dark:border-slate-800 dark:bg-slate-900/40">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-12 text-center">
            <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl dark:text-white">
              Chỉ 4 bước để có điểm ngay
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, i) => (
              <div key={step.n} className="relative">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white">
                  {step.n}
                </div>
                <h3 className="mt-4 font-semibold text-slate-900 dark:text-white">{step.title}</h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{step.desc}</p>
                {i < STEPS.length - 1 && (
                  <div className="absolute right-[-12px] top-5 hidden h-px w-6 bg-slate-300 sm:block dark:bg-slate-700" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-5xl px-6 py-24">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 to-violet-600 px-8 py-16 text-center shadow-2xl shadow-indigo-600/30 sm:px-16">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-20 -left-10 h-64 w-64 rounded-full bg-white/10 blur-3xl"
          />
          <h2 className="text-2xl font-bold text-white sm:text-3xl">Đừng để kỳ thi làm bạn bất ngờ</h2>
          <p className="mx-auto mt-3 max-w-xl text-indigo-100">
            Mỗi lần luyện đề là một lần AI hiểu bạn hơn. Bắt đầu ngay hôm nay, miễn phí, không ràng buộc.
          </p>
          <Link
            to="/register"
            className="mt-8 inline-block rounded-xl bg-white px-8 py-3.5 text-base font-semibold text-indigo-700 shadow-lg transition hover:-translate-y-0.5 hover:bg-indigo-50"
          >
            Tạo tài khoản miễn phí →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-10 dark:border-slate-800">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 text-sm text-slate-400 sm:flex-row">
          <span>© {new Date().getFullYear()} EduPath</span>
          <span>Đồng hành ôn thi THPT & Đánh giá năng lực cùng AI</span>
        </div>
      </footer>
    </div>
  );
}
