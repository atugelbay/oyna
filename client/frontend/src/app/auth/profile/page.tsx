import { redirect } from "next/navigation";
export default function LegacyProfilePage() {
  redirect("/auth/register");
}
