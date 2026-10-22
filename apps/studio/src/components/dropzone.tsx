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
      // The field frame, dashed, on the page ground (as the maker portrait's
      // drop target): the frame turns ink on hover, and a file held over it
      // gives the accent frame on the accent wash.
      className={`border border-dashed px-4 py-6 text-center transition-[border-color,background-color] duration-150 ${
        disabled
          ? "cursor-not-allowed border-rule-strong bg-band opacity-60"
          : over
            ? "cursor-copy border-accent bg-accent-wash"
            : "cursor-pointer border-[var(--jvb-field-frame)] bg-page hover:border-ink"
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
