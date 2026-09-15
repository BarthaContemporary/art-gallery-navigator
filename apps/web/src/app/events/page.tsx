import { redirect } from "next/navigation";

/** Home is the Events page; keep /events as a stable address for it. */
export default function EventsPage() {
  redirect("/");
}
