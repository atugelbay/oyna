import { redirect } from "next/navigation";

/** Добавление сотрудника — только модалка на /settings/employees */
export default function EmployeesNewLegacyRedirect() {
  redirect("/settings/employees");
}
