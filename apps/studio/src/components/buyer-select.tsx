"use client";

import { useEffect, useRef, useState } from "react";

type Result = { id: string; name: string; email: string | null };

const input =
  "w-full rounded-lg border border-line-control bg-control px-3 py-2 text-[13.5px] text-ink-body";

export function BuyerSelect({
  initialId,
  initialName,
}: {
  initialId?: string | null;
  initialName?: string | null;
}) {
  const [id, setId] = useState(initialId ?? "");
  const [name, setName] = useState(initialName ?? "");
  const [searching, setSearching] = useState(!(initialId ?? ""));
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);

  // Debounced search against the CRM contacts endpoint.
  useEffect(() => {
    if (!searching) return;
    const query = q.trim();
    if (query.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    let cancelled = false;
    const t = setTimeout(() => {
      fetch(`/api/crm/contacts/search?q=${encodeURIComponent(query)}`)
        .then((r) => (r.ok ? r.json() : { results: [] }))
        .then((json: { results?: Result[] }) => {
          if (!cancelled) setResults(json.results ?? []);
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q, searching]);

  const pick = (r: Result) => {
    setId(r.id);
    setName(r.name);
    setSearching(false);
    setQ("");
    setResults([]);
  };

  const clear = () => {
    setId("");
    setName("");
    setSearching(true);
    setQ("");
    setResults([]);
  };

  return (
    <div>
      <input type="hidden" name="buyer_contact_id" value={id} />

      {id && !searching ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line-control px-2.5 py-0.5 text-[12px] text-ink-body">
            {name || "Selected contact"}
            <button
              type="button"
              onClick={clear}
              aria-label="Clear buyer"
              className="text-ink-muted hover:text-oranje"
            >
              ×
            </button>
          </span>
          <button
            type="button"
            onClick={() => setSearching(true)}
            className="text-[12px] text-oranje"
          >
            change
          </button>
        </div>
      ) : (
        <div>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search CRM contacts…"
            className={input}
          />
          {loading ? (
            <p className="mt-1 text-[12px] text-ink-muted">Searching…</p>
          ) : results.length > 0 ? (
            <ul className="mt-1 divide-y divide-line-control overflow-hidden rounded-lg border border-line-control">
              {results.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => pick(r)}
                    className="flex w-full flex-col items-start px-3 py-2 text-left text-[13.5px] text-ink-body hover:bg-control"
                  >
                    <span>{r.name}</span>
                    {r.email ? (
                      <span className="text-[12px] text-ink-muted">{r.email}</span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : q.trim().length >= 2 ? (
            <p className="mt-1 text-[12px] text-ink-muted">No matches.</p>
          ) : null}
          {id ? (
            <button
              type="button"
              onClick={() => setSearching(false)}
              className="mt-1 text-[12px] text-ink-muted hover:text-oranje"
            >
              cancel
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
