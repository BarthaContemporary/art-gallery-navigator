/**
 * Token-independent document upload, shared by every surface that attaches
 * files (shipments, works, the Documents area).
 *
 * Three legs: a cookie-authed route signs the upload, the browser PUTs the
 * file straight to storage with no auth token at all, and a second
 * cookie-authed route writes the row (deleting the object again if the row is
 * refused). The browser client's access token is never involved, so a revoked
 * session — the source of the "intermittent" upload failures — cannot touch
 * an upload. If the cookie session itself has died, the routes say so in
 * plain words instead of failing cryptically.
 */

export type UploadScope = "shipment" | "piece" | "document";

export type CommitExtras = {
  title?: string;
  docType?: string;
  reference?: string;
  docDate?: string;
};

export type UploadedDoc = { id: string; title: string; storage_path: string };

const SESSION_DEAD =
  "Your session has expired — reload the page and sign in again, your files are still selected.";

/** POST JSON to one of our API routes; translate a login bounce into words. */
async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  // A dead cookie session gets redirected to /login by the middleware; the
  // response is then HTML, not JSON.
  if (res.redirected || res.status === 401) throw new Error(SESSION_DEAD);
  let json: (T & { error?: string }) | null = null;
  try {
    json = (await res.json()) as T & { error?: string };
  } catch {
    throw new Error(SESSION_DEAD);
  }
  if (!res.ok) throw new Error(json?.error ?? `Request failed (${res.status})`);
  return json as T;
}

/** PUT the file to the signed URL; one automatic retry on transient failure. */
async function putFile(signedUrl: string, file: File): Promise<void> {
  const attempt = () =>
    fetch(signedUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type || "application/octet-stream" },
      body: file,
    });
  let res: Response | null = null;
  try {
    res = await attempt();
  } catch {
    res = null; // network hiccup — retry below
  }
  if (!res || res.status >= 500) {
    await new Promise((r) => setTimeout(r, 1500));
    try {
      res = await attempt();
    } catch {
      res = null;
    }
  }
  if (!res) {
    // Both attempts failed before any HTTP response existed: this computer
    // could not reach the storage server at all. Say so in words that
    // diagnose themselves — the file never left the machine, and the fix is
    // on the network, not in the studio.
    const host = (() => {
      try {
        return new URL(signedUrl).host;
      } catch {
        return "the gallery server";
      }
    })();
    throw new Error(
      `this computer could not reach ${host} — the file never left the machine. ` +
        `That is a network problem, not a studio problem: try again on a different ` +
        `network (e.g. a phone hotspot) and tell the office which one worked.`,
    );
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Storage refused the file (${res.status})${text ? ` — ${text.slice(0, 120)}` : ""}`);
  }
}

/**
 * Upload one file and record it. Throws with a message that names what went
 * wrong; the caller prefixes the file name.
 */
export async function uploadDocument(
  scope: UploadScope,
  recordId: string | null,
  file: File,
  extras: CommitExtras = {},
): Promise<UploadedDoc> {
  const { path, signedUrl } = await post<{ path: string; signedUrl: string }>(
    "/api/files/sign",
    { scope, recordId: recordId ?? undefined, filename: file.name },
  );
  await putFile(signedUrl, file);
  return post<UploadedDoc>("/api/files/commit", {
    scope,
    recordId: recordId ?? undefined,
    path,
    title: extras.title?.trim() || file.name,
    docType: extras.docType,
    reference: extras.reference,
    docDate: extras.docDate,
  });
}
