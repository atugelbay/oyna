import { redirect } from "next/navigation";

/** Старый URL: редактирование только через модалку на /settings/loyalty */
export default function LoyaltyEditLegacyRedirect() {
  redirect("/settings/loyalty");
}
