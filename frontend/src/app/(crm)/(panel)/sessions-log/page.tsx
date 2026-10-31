"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { useCrmVenue } from "@/lib/venue-context";

export default function SessionsLogPage() {
  const { selectedVenueId } = useCrmVenue();
  const [rows, setRows] = useState<any[]>([]);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  function load() {
    api.get("/sessions-journal", { params: { venueId: selectedVenueId || undefined } })
      .then(({ data }) => setRows(data.data ?? []))
      .catch(() => setRows([]));
  }

  useEffect(() => { load(); }, [selectedVenueId]);

  async function download() {
    const { data } = await api.get("/sessions-journal/export", {
      params: { venueId: selectedVenueId || undefined },
      responseType: "blob",
    });
    const url = URL.createObjectURL(data);
    const link = document.createElement("a");
    link.href = url;
    link.download = "oyna-sessions.xls";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function compensate(sessionId: string, playerId: string) {
    setError("");
    if (!reason.trim()) {
      setError("Напишите причину компенсации");
      return;
    }
    try {
      await api.post(`/players/${playerId}/compensate/${sessionId}`, { reason });
      setReason("");
      load();
    } catch (e: any) {
      setError(e?.response?.data?.message || "Компенсация не начислена");
    }
  }

  return (
    <div className="space-y-3 text-text-primary">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Сеансы</h1>
        <button type="button" onClick={download} className="min-h-11 rounded-xl bg-bg-secondary px-3 text-sm">Скачать Excel</button>
      </div>
      <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Причина компенсации, если игра сорвалась" className="min-h-12 w-full rounded-xl bg-bg-secondary px-3 text-base" />
      {error && <p className="text-sm text-red-400">{error}</p>}
      {rows.map((row) => (
        <article key={row.id} className="rounded-xl bg-bg-secondary p-3 text-sm">
          <p className="font-semibold">{row.room} · {row.mode}</p>
          <p>{row.start ? new Date(row.start).toLocaleString("ru-RU", { timeZone: "Asia/Almaty" }) : "—"}{row.end ? ` – ${new Date(row.end).toLocaleTimeString("ru-RU", { timeZone: "Asia/Almaty" })}` : ""}</p>
          <p>{row.players?.join(", ") || "Гость"}</p>
          <p>Списано {row.paidMinutes} оплаченных / {row.bonusMinutes} бонусных · {row.status}</p>
          {row.endReason && <p>Причина: {row.endReason}</p>}
          {row.compensatedAt && <p>Компенсация уже начислена</p>}
          {!row.compensatedAt && row.playerIds?.[0] && (
            <button type="button" onClick={() => compensate(row.id, row.playerIds[0])} className="mt-2 min-h-11 rounded-xl bg-bg-card px-3">Компенсировать 10 минут</button>
          )}
        </article>
      ))}
    </div>
  );
}
