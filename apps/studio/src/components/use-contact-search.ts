"use client";

import { useEffect, useState } from "react";

export type ContactHit = { id: string; name: string; email: string | null };

/**
 * Debounced search of the CRM contacts (/api/crm/contacts/search), shared by
 * the buyer picker and the consignment panel's contact link.
 *
 *   const { results, loading, error } = useContactSearch(query, enabled);
 *
 * Searches 300 ms after the query settles, once it has two characters; a
 * newer query cancels an older answer. `enabled` false (buyer-select's
 * "not searching" state) runs nothing. `error` is the sentence to show in
 * place of "No matches." when the search itself failed: a failed search
 * must not read as "this client is not in the CRM", or a duplicate contact
 * gets created.
 */
export function useContactSearch(query: string, enabled = true) {
  const [results, setResults] = useState<ContactHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    let cancelled = false;
    const t = setTimeout(() => {
      fetch(`/api/crm/contacts/search?q=${encodeURIComponent(q)}`)
        .then(async (r) => {
          if (cancelled) return;
          if (r.status === 401) {
            setResults([]);
            setError("Signed out. Sign in again to search the contacts.");
            return;
          }
          if (!r.ok) throw new Error(String(r.status));
          const json = (await r.json()) as { results?: ContactHit[] };
          if (cancelled) return;
          setResults(Array.isArray(json.results) ? json.results : []);
          setError(null);
        })
        .catch(() => {
          if (cancelled) return;
          setResults([]);
          setError("Search isn’t available just now. Try again in a moment.");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, enabled]);

  return { results, setResults, loading, error };
}
