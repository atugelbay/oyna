import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-[720px] px-5 py-10 text-sm leading-relaxed text-slate-300">
      <Link href="/auth/register" className="text-brand">← назад</Link>
      <h1 className="mb-4 mt-6 text-3xl font-extrabold text-white">Дербес деректер / Персональные данные</h1>
      <p className="mb-3">Нұсқа / версия 2026-10-29. Сервер Қазақстанда.</p>
      <p>Аккаунтты ойыншының өзі (18+) немесе ата-анасы / заңды өкілі бала үшін тіркейді. Сақталады: ник, телефон, туған күн, келісімдердің уақыты мен нұсқасы. Өшіруді сұрағанда жеке деректер жойылады, сату мен сеанстар «Удалённый игрок» болып қалады.</p>
    </main>
  );
}
