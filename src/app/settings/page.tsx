import { redirect } from "next/navigation";

// /settings has no content of its own — the rail's first entry is the
// landing surface. Server-side redirect lands the user there without a
// client-side flash of an empty content column.
export default function SettingsRedirect() {
  redirect("/settings/general");
}
