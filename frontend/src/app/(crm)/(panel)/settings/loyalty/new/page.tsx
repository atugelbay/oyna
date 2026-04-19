import { redirect } from "next/navigation";

/** Старый URL: добавление только через модалку на /settings/loyalty */
export default function LoyaltyNewLegacyRedirect() {
  redirect("/settings/loyalty");
}
