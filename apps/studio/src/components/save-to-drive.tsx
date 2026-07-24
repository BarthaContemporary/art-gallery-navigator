"use client";

import { useRef, useState } from "react";

/**
 * Export control: instead of a browser download, the document is saved onto
 * the gallery's shared drive (Downloads/Certificates|Presentations|Docs) by
 * calling the export route with ?mode=drive. The label flips to a visible
 * confirmation with the exact drive path in the tooltip.
 */
export function SaveToDriveLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [detail, setDetail] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function save(e: React.MouseEvent) {
    e.preventDefault();
    if (state === "saving") return;
    if (timer.current) clearTimeout(timer.current);
    setState("saving");
    try {
      const sep = href.includes("?") ? "&" : "?";
      // Custom header proves this came from our own JS (CSRF guard on the route).
      const res = await fetch(`${href}${sep}mode=drive`, {
        headers: { "x-jvb-drive-save": "1" },
      });
      const json = (await res.json()) as { ok?: boolean; folder?: string; filename?: string; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Save failed");
      setDetail(`Saved to Downloads/${json.folder}/${json.filename}`);
      setState("saved");
      timer.current = setTimeout(() => setState("idle"), 5000);
    } catch (err) {
      setDetail(err instanceof Error ? err.message : "Save failed");
      setState("error");
      timer.current = setTimeout(() => setState("idle"), 6000);
    }
  }

  return (
    <a href={href} onClick={save} className={className} title={detail || "Saves onto the shared drive"}>
      {state === "saving" ? "Saving…" : state === "saved" ? "Saved to drive ✓" : state === "error" ? "Failed — retry?" : children}
    </a>
  );
}
