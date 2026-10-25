import { redirect } from "next/navigation";
// Keep old bookmarks usable without accepting one-time codes.
export default function LegacyVerifyPage() {
  redirect("/auth/login");
}
