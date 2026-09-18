"use client";

import { useEffect, useState, type ChangeEvent, type FocusEvent, type InputHTMLAttributes } from "react";
import { cleanNumberPaste, parseAmount } from "@/lib/amount";

/**
 * Money field that reads and writes the way people do: "1,200" can be typed
 * or pasted, and the value is shown with thousands separators whenever the
 * field is not being edited. The form value keeps the commas; every server
 * path parses it with parseAmount. A text input, so the browser never
 * refuses a comma the way <input type="number"> does.
 */
export function AmountInput({
  value,
  defaultValue,
  onChange,
  onBlur,
  decimals = 2,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "defaultValue" | "onChange"> & {
  value?: string;
  defaultValue?: string;
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
  /** Maximum decimals shown once the field loses focus. */
  decimals?: number;
}) {
  const controlled = value !== undefined;
  const [text, setText] = useState(() => format(controlled ? value : (defaultValue ?? ""), decimals));
  const [editing, setEditing] = useState(false);

  // A controlled value that changes while the field is not being edited
  // (a mirrored cost, a spot conversion) is shown formatted.
  useEffect(() => {
    if (controlled && !editing) setText(format(value, decimals));
  }, [controlled, value, editing, decimals]);

  return (
    <input
      {...rest}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={text}
      onPaste={cleanNumberPaste}
      onFocus={(e) => {
        setEditing(true);
        rest.onFocus?.(e);
      }}
      onChange={(e) => {
        setText(e.target.value);
        onChange?.(e);
      }}
      onBlur={(e: FocusEvent<HTMLInputElement>) => {
        setEditing(false);
        const formatted = format(e.target.value, decimals);
        if (formatted !== e.target.value) {
          setText(formatted);
          // Let controlled parents pick up the tidied value too.
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
          setter?.call(e.target, formatted);
          e.target.dispatchEvent(new Event("input", { bubbles: true }));
        }
        onBlur?.(e);
      }}
    />
  );
}

/** "1200.5" → "1,200.50"; "" or nonsense → "" (the field is simply empty). */
export function format(raw: string | undefined, decimals: number): string {
  if (raw === undefined || raw.trim() === "") return "";
  const n = parseAmount(raw);
  if (n === null) return raw;
  const hasFraction = Math.abs(n % 1) > 0;
  return n.toLocaleString("en-GB", {
    minimumFractionDigits: hasFraction ? Math.min(2, decimals) : 0,
    maximumFractionDigits: decimals,
  });
}
