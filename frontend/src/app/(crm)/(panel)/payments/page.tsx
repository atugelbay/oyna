"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";

export default function PaymentsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [totals, setTotals] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/cash/sales")
      .then(({ data }) => {
        setRows(data.data ?? []);
        setTotals(data.totals);
      })
      .catch((e) => setError(e?.response?.data?.message || "Нет доступа"));
  }, []);

  return (
    <div className="space-y-3 text-text-primary">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Оплаты</h1>
        <button
          type="button"
          className="min-h-11 rounded-xl bg-bg-secondary px-3 text-sm"
          onClick={async () => {
            const { data } = await api.get("/cash/sales/export", { responseType: "blob" });
            const url = URL.createObjectURL(data);
            const link = document.createElement("a");
            link.href = url;
            link.download = "oyna-sales.xls";
            link.click();
            URL.revokeObjectURL(url);
          }}
        >
          Скачать Excel
        </button>
      </div>
      {totals && <p className="text-sm text-text-secondary">{totals.count} оплат · {totals.sum} ₸ · средний {totals.average} ₸</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="space-y-2 md:hidden">
        {rows.map((row) => (
          <article key={row.id} className="rounded-xl bg-bg-secondary p-3 text-sm">
            <p className="font-semibold">{row.totalTenge} ₸ · {row.status}</p>
            <p>{new Date(row.createdAt).toLocaleString("ru-RU", { timeZone: "Asia/Almaty" })}</p>
            <p>{row.operatorName} · смена {row.shift?.number ?? "—"}</p>
            <p>{row.payments?.map((p: any) => `${p.method} ${p.amountTenge}`).join(", ")}</p>
            <p>{row.lines?.map((l: any) => l.name).join(", ")}</p>
          </article>
        ))}
      </div>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-white/10">
                <td className="py-2">{new Date(row.createdAt).toLocaleString("ru-RU", { timeZone: "Asia/Almaty" })}</td>
                <td>{row.totalTenge} ₸</td>
                <td>{row.operatorName}</td>
                <td>{row.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
