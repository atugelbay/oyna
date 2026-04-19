import { redirect } from "next/navigation";

/** Редактирование — только модалка на /settings/employees */
export default function EmployeesEditLegacyRedirect() {
  redirect("/settings/employees");
}
