"use client";

import { useCallback, useEffect, useState } from "react";
import api from "@/lib/api";
import { useCrmVenue } from "@/lib/venue-context";
import { formatTenge } from "@/lib/money";
import { almatyRange, almatyToday } from "@/lib/almaty";
import { readApiUserError } from "@/lib/api-error-message";

type OperatorRow = {
  operatorId: string;
  operatorName: string;
  shifts: number;
  sales: number;
  cancelled: number;
  cancelledSum: number;
  unchecked: number;
  cash: number;
  kaspi: number;
  halyk: number;
  freedom: number;
  gaps: number;
  manualMinutes: number;
  compensations: number;
  compensationMinutes: number;
};

type Kind = "sales" | "cancelled" | "unchecked" | "compensations" | "manual" | "gaps";

const KIND_TITLE: Record<Kind, string> = {
  sales: "Продажи",
  cancelled: "Отменённые продажи",
  unchecked: "Продажи без чека",
  compensations: "Компенсации",
  manual: "Ручные минуты",
  gaps: "Смены с расхождением",
};

export default function OperatorsPage() {
  const { selectedVenueId } = useCrmVenue();
  const today = almatyToday();
  const [from, setFrom] = useState(`${today.slice(0, 7)}-01`);
  const [to, setTo] = useState(today);
  const [rows, setRows] = useState<OperatorRow[]>([]);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<{ row: OperatorRow; kind: Kind } | null>(null);

  const load = useCallback(() => {
    api
      .get("/cash/operators", { params: { venueId: selectedVenueId || undefined, ...almatyRange(from, to) } })
      .then(({ data }) => {
        setRows(Array.isArray(data) ? data : []);
        setError("");
      })
      .catch((e) => setError(readApiUserError(e, "Итоги по операторам видит владелец")));
  }, [selectedVenueId, from, to]);

  useEffect(() => load(), [load]);

  const Num = ({ row, kind, children }: { row: OperatorRow; kind: Kind; children: React.ReactNode }) => (
    <button
      type="button"
      onClick={() => setOpen({ row, kind })}
      className="rounded-md px-1 font-semibold text-cyan underline-offset-2 hover:underline"
    >
      {children}
    </button>
  );

  return (
    <div className="space-y-3 text-text-primary">
      <h1 className="text-2xl font-bold">Операторы</h1>
      <div className="flex flex-wrap gap-2">
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="min-h-11 rounded-xl bg-bg-secondary px-3 text-sm" />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="min-h-11 rounded-xl bg-bg-secondary px-3 text-sm" />
      </div>
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {rows.length === 0 && !error ? <p className="text-sm text-text-secondary">За период нет операций</p> : null}
      <div className="space-y-2">
        {rows.map((row) => (
          <article key={row.operatorId} className="space-y-1 rounded-xl bg-bg-secondary p-3 text-sm">
            <p className="font-semibold">{row.operatorName}</p>
            <p>
              Смен {row.shifts} · оплат <Num row={row} kind="sales">{row.sales}</Num> · без чека{" "}
              <Num row={row} kind="unchecked">
                <span className={row.unchecked ? "text-amber-300" : ""}>{row.unchecked}</span>
              </Num>{" "}
              · отмены <Num row={row} kind="cancelled">{row.cancelled}</Num> на {formatTenge(row.cancelledSum)}
            </p>
            <p>
              Компенсации <Num row={row} kind="compensations">{row.compensations}</Num> ({row.compensationMinutes} мин) · ручные
              минуты <Num row={row} kind="manual">{row.manualMinutes}</Num> · расхождения{" "}
              <Num row={row} kind="gaps">
                <span className={row.gaps ? "text-red-400" : ""}>{row.gaps}</span>
              </Num>
            </p>
            <p className="text-text-secondary">
              Наличные {formatTenge(row.cash)} · Kaspi {formatTenge(row.kaspi)} · Halyk {formatTenge(row.halyk)} · Freedom{" "}
              {formatTenge(row.freedom)}
            </p>
          </article>
        ))}
      </div>

      {open ? (
        <Operations
          operatorId={open.row.operatorId}
          title={`${open.row.operatorName}: ${KIND_TITLE[open.kind]}`}
          kind={open.kind}
          venueId={selectedVenueId}
          from={from}
          to={to}
          onClose={() => setOpen(null)}
        />
      ) : null}
    </div>
  );
}

function Operations({
  operatorId,
  title,
  kind,
  venueId,
  from,
  to,
  onClose,
}: {
  operatorId: string;
  title: string;
  kind: Kind;
  venueId: string | null;
  from: string;
  to: string;
  onClose: () => void;
}) {
  const [items, setItems] = useState<{ id: string; at: string; title: string; detail: string }[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get(`/team/operators/${operatorId}/operations`, {
        params: { kind, venueId: venueId || undefined, ...almatyRange(from, to) },
      })
      .then(({ data }) => setItems(Array.isArray(data) ? data : []))
      .catch((e) => {
        setItems([]);
        setError(readApiUserError(e, "Не загрузилось"));
      });
  }, [operatorId, kind, venueId, from, to]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-[#141C26] p-5 shadow-xl">
        <h3 className="text-lg font-semibold">{title}</h3>
        {error ? <p className="mt-2 text-sm text-red-400">{error}</p> : null}
        {items == null ? <p className="mt-3 text-sm text-text-secondary">Загрузка…</p> : null}
        {items && items.length === 0 && !error ? <p className="mt-3 text-sm text-text-secondary">Пусто</p> : null}
        <ul className="mt-3 space-y-2 text-sm">
          {items?.map((it) => (
            <li key={it.id} className="rounded-xl bg-bg-card px-3 py-2">
              <p className="font-medium">{it.title.replace(/(\d+) ₸/, (_, n) => formatTenge(Number(n)))}</p>
              <p className="text-xs text-text-secondary">
                {new Date(it.at).toLocaleString("ru-RU", { timeZone: "Asia/Almaty" })}
                {it.detail ? ` · ${it.detail}` : ""}
              </p>
            </li>
          ))}
        </ul>
        <button type="button" onClick={onClose} className="mt-4 min-h-12 w-full rounded-xl bg-bg-card">
          Закрыть
        </button>
      </div>
    </div>
  );
}
