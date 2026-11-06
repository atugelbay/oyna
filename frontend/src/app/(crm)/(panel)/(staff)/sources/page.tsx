import { redirect } from "next/navigation";

/** «Источники» — это маркетинг: отчёт переехал в Финансы → Статистика. */
export default function SourcesPage() {
  redirect("/stats#sources");
}
