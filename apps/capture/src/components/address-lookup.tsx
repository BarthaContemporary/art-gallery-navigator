"use client";

import { useEffect, useRef, useState } from "react";

/* eslint-disable @typescript-eslint/no-explicit-any */

const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

export type AddressParts = {
  line1: string;
  line2: string;
  city: string;
  postcode: string;
  country: string;
  company: string;
};

// Google's official inline bootstrap loader (defines importLibrary reliably).
let mapsPromise: Promise<any> | null = null;
function loadMaps(): Promise<any> {
  if (!MAPS_KEY) return Promise.reject(new Error("no key"));
  if (typeof window === "undefined") return Promise.reject(new Error("ssr"));
  const w = window as any;
  if (w.google?.maps?.importLibrary) return Promise.resolve(w.google);
  if (mapsPromise) return mapsPromise;
  mapsPromise = new Promise<any>((resolve, reject) => {
    try {
      ((g: Record<string, string>) => {
        let h: Promise<void> | undefined;
        const c = "google";
        const b: any = (w[c] = w[c] || {});
        const d: any = (b.maps = b.maps || {});
        const r = new Set<string>();
        const e = new URLSearchParams();
        const u = () =>
          h ||
          (h = new Promise<void>((res, rej) => {
            const a = document.createElement("script");
            e.set("libraries", [...r].join(","));
            for (const k in g) {
              const val = g[k];
              if (val !== undefined) e.set(k.replace(/[A-Z]/g, (t) => "_" + t.toLowerCase()), val);
            }
            e.set("callback", c + ".maps.__ib__");
            a.src = "https://maps.googleapis.com/maps/api/js?" + e;
            d.__ib__ = res;
            a.onerror = () => {
              h = undefined;
              rej(new Error("could not load"));
            };
            document.head.append(a);
          }));
        if (!d.importLibrary)
          d.importLibrary = (f: string, ...n: unknown[]) => r.add(f) && u().then(() => d.importLibrary(f, ...n));
      })({ key: MAPS_KEY, v: "weekly" });
      if (w.google?.maps?.importLibrary) resolve(w.google);
      else reject(new Error("bootstrap failed"));
    } catch (err) {
      reject(err);
    }
  });
  return mapsPromise;
}

/**
 * Google Places address lookup for the contact form. Picking a suggestion
 * fills the structured address fields (that IS the validation — a real,
 * resolvable place) and flags the contact as verified.
 */
export function AddressLookup({ onPick }: { onPick: (parts: AddressParts) => void }) {
  const host = useRef<HTMLDivElement>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!MAPS_KEY || !host.current) return;
    let el: any;
    let cancelled = false;
    loadMaps()
      .then(async (g) => {
        const places = await g.maps.importLibrary("places");
        if (cancelled || !host.current) return;
        if (!places?.PlaceAutocompleteElement) {
          setMsg("Address lookup unavailable — enable “Places API (New)” for this key.");
          return;
        }
        setMsg(null);
        el = new places.PlaceAutocompleteElement();
        el.style.width = "100%";
        try {
          el.style.colorScheme = "light";
          el.style.background = "transparent";
          el.style.border = "none";
          el.style.fontFamily = "inherit";
          el.style.fontSize = "16px";
          el.style.color = "var(--jvb-ink-body)";
        } catch {
          /* older builds */
        }
        host.current.appendChild(el);
        el.addEventListener("gmp-select", async (ev: any) => {
          try {
            const place = ev.placePrediction.toPlace();
            await place.fetchFields({ fields: ["addressComponents", "displayName", "types"] });
            const parts: Record<string, string> = {};
            for (const c of place.addressComponents ?? []) {
              for (const t of c.types) parts[t] = c.longText ?? c.shortText ?? "";
            }
            const isEstablishment = (place.types ?? []).includes("establishment");
            const company = isEstablishment && typeof place.displayName === "string" ? place.displayName : "";
            onPick({
              company,
              line1: [parts.street_number, parts.route].filter(Boolean).join(" "),
              line2: parts.subpremise || parts.premise || "",
              city: parts.postal_town || parts.locality || parts.sublocality || "",
              postcode: parts.postal_code || "",
              country: parts.country || "",
            });
          } catch {
            /* ignore */
          }
        });
      })
      .catch(() => setMsg("Address lookup couldn’t load — enter the address manually."));
    return () => {
      cancelled = true;
      if (el?.remove) el.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!MAPS_KEY) return null;

  return (
    <div>
      <span className="block text-[11px] font-medium uppercase tracking-[0.05em] text-ink-faint">Find address</span>
      <div
        ref={host}
        className="mt-1 flex items-center rounded-lg border border-line-control bg-control px-2 [color-scheme:light] [&_gmp-place-autocomplete]:w-full [&_gmp-place-autocomplete]:bg-transparent"
      />
      {msg ? <p className="mt-1 text-[11.5px] text-ink-soft">{msg}</p> : null}
    </div>
  );
}
