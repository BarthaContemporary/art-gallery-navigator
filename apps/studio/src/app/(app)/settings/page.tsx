import { redirect } from "next/navigation";

// Account and Settings were merged into a single Admin page.
export default function SettingsRedirect() {
  redirect("/admin");
}
