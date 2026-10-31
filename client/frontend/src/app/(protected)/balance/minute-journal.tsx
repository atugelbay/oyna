'use client';

import { useEffect, useState } from 'react';
import { balanceService } from '@/services/balance.service';

type Row = { id: string; type: string; minutes: number; reason: string | null; kind: string | null; at: string };

const typeLabel: Record<string, string> = {
  CREDIT: 'Начисление',
  DEBIT: 'Списание',
  EXPIRE: 'Сгорело',
  CANCEL: 'Отмена',
};

export function MinuteJournal() {
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    balanceService.getLedger().then(setRows).catch(() => setRows([]));
  }, []);

  if (!rows.length) return null;

  return (
    <section className="mb-6">
      <h2 className="mb-4 text-lg font-bold">Журнал минут</h2>
      <div className="panel overflow-hidden">
        {rows.map((row) => (
          <div key={row.id} className="flex items-center gap-3 border-b border-white/5 p-4 last:border-0">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{typeLabel[row.type] ?? row.type}{row.kind ? ` · ${row.kind}` : ''}</p>
              <p className="mt-1 text-[11px] text-slate-500">
                {row.reason || 'Без комментария'} · {new Date(row.at).toLocaleString('ru-RU', { timeZone: 'Asia/Almaty', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            <p className="text-sm font-bold">{row.minutes > 0 ? `${row.minutes} мин` : '0'}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
