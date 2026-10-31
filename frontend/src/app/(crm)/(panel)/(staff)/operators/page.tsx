"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import api from "@/lib/api";
import { useCrmVenue } from "@/lib/venue-context";

export default function OperatorsPage() {
  const { selectedVenueId } = useCrmVenue();
  const [rows, setRows] = useState<any[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/cash/operators", { params: { venueId: selectedVenueId || undefined } })
      .then(({ data }) => setRows(data))
      .catch((e) => setError(e?.response?.data?.message || "Только владелец видит итоги по операторам"));
  }, [selectedVenueId]);

  return (
    <div className="space-y-3 text-text-primary">
      <h1 className="text-2xl font-bold">Операторы</h1>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="space-y-2">
        {rows.map((row) => (
          <article key={row.operatorId} className="rounded-xl bg-bg-secondary p-3 text-sm">
            <p className="font-semibold">{row.operatorName}</p>
            <p>Смен {row.shifts} · оплат {row.sales} · отмены {row.cancelledSum} ₸ · ручные {row.manualMinutes} мин · расхождения {row.gaps}</p>
            <p>Наличные {row.cash} · Kaspi {row.kaspi} · Halyk {row.halyk} · Freedom {row.freedom}</p>
            <Link href={`/payments?operatorId=${row.operatorId}`} className="mt-2 inline-flex min-h-11 items-center text-cyan">Его оплаты</Link>
          </article>
        ))}
      </div>
    </div>
  );
}
