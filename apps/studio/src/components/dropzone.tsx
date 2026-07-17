"use client";

import { useRef, useState, type ReactNode } from "react";

/**
 * A click-or-drag file drop target. Calls `onFiles` with whatever is dropped or
 * picked; the caller decides what to do (stage, upload immediately, …).
 */
export function Dropzone({
  onFiles,
  accept,
  multiple = false,
  capture,
  disabled = false,
  children,
}: {
  onFiles: (files: FileList | null) => void;
  accept?: string;
  multiple?: boolean;
  capture?: "user" | "environment";
  disabled?: boolean;
  children: ReactNode;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const open = () => {
    if (!disabled) inputRef.current?.click();
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (!disabled) onFiles(e.dataTransfer.files);
      }}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      }}
      role="button"
      tabIndex={0}
      aria-disabled={disabled}
      className={`cursor-pointer rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors ${
        disabled
          ? "cursor-not-allowed border-line-soft bg-band/40 opacity-60"
          : over
            ? "border-oranje bg-band"
            : "border-line-control bg-control/40 hover:border-line"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        capture={capture}
        className="hidden"
        onChange={(e) => {
          onFiles(e.target.files);
          e.target.value = "";
        }}
      />
      {children}
    </div>
  );
}
