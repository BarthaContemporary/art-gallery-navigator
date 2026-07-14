"use client";

import { useRef, useState } from "react";

type Result = { imported: number; skipped: number; errors: number };
type Status = "idle" | "uploading" | "done" | "error";

const input =
  "w-full rounded-lg border border-line-control bg-control px-3 py-2 text-[13.5px] text-ink-body file:mr-3 file:rounded-md file:border-0 file:bg-band file:px-3 file:py-1 file:text-[12px] file:text-ink-mid";

export function ImportForm() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<Result | null>(null);
  const [message, setMessage] = useState<string>("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const file = inputRef.current?.files?.[0];
    if (!file) {
      setStatus("error");
      setMessage("Please choose a .csv file first.");
      return;
    }
    setStatus("uploading");
    setResult(null);
    setMessage("");

    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/crm/contacts/import", {
        method: "POST",
        body: fd,
      });
      const body = (await res.json().catch(() => null)) as
        | (Result & { error?: string })
        | { error?: string }
        | null;

      if (!res.ok) {
        setStatus("error");
        setMessage(
          (body && "error" in body && body.error) || "The import failed. Please try again.",
        );
        return;
      }

      setResult(body as Result);
      setStatus("done");
    } catch {
      setStatus("error");
      setMessage("Could not reach the server. Please try again.");
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block text-[11px] font-medium uppercase tracking-[0.06em] text-ink-faint">
        CSV file
        <input
          ref={inputRef}
          type="file"
          name="file"
          accept=".csv,text/csv"
          className={`mt-1 ${input}`}
        />
      </label>

      <button
        type="submit"
        disabled={status === "uploading"}
        className="rounded-lg bg-primary px-3.5 py-2 text-[12.5px] font-semibold text-primary-fg disabled:opacity-60"
      >
        {status === "uploading" ? "Importing…" : "Import contacts"}
      </button>

      {status === "done" && result ? (
        <p className="text-[13px] text-status-green" aria-live="polite">
          Imported {result.imported}, skipped {result.skipped} duplicate
          {result.skipped === 1 ? "" : "s"}, {result.errors} error
          {result.errors === 1 ? "" : "s"}.
        </p>
      ) : null}

      {status === "error" ? (
        <p className="text-[13px] text-oranje" aria-live="polite">
          {message}
        </p>
      ) : null}
    </form>
  );
}
