"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { UploadIcon } from "@/components/ui/icons";

type Result = { imported: number; skipped: number; errors: number };
type Status = "idle" | "uploading" | "done" | "error";

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

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
      setMessage("Choose a .csv file first.");
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
      <div className="flex min-w-0 flex-col gap-1">
        <label htmlFor="import-file" className="label">
          CSV file
        </label>
        {/* The file button in the secondary button's look, on the field fill. */}
        <input
          ref={inputRef}
          id="import-file"
          type="file"
          name="file"
          accept=".csv,text/csv"
          className="field h-auto py-1.5 file:mr-3 file:h-[var(--jvb-control-h-sm)] file:cursor-pointer file:border file:border-solid file:border-rule-strong file:bg-page file:px-2.5 file:text-[12px] file:font-medium file:text-ink"
        />
      </div>

      <Button
        type="submit"
        variant="primary"
        pending={status === "uploading"}
        pendingLabel="Importing…"
        icon={<UploadIcon size={14} />}
      >
        Import contacts
      </Button>

      {status === "done" && result ? (
        <Notice tone={result.errors > 0 ? "warn" : "ok"}>
          Imported {result.imported}, skipped {plural(result.skipped, "duplicate")}, {plural(result.errors, "error")}.
        </Notice>
      ) : null}

      {status === "error" ? <Notice tone="danger">{message}</Notice> : null}
    </form>
  );
}
