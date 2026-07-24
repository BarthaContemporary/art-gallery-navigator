/**
 * Mirror of every document the studio produces onto the gallery's WebDAV
 * shared drive, under Downloads/<folder>:
 *   Certificates  — certificates produced from inventory
 *   Presentations — documents saved from Offers
 *   Docs          — everything else (fact sheets, labels, list exports…)
 *
 * The copy is best-effort: if the drive is unreachable or the env is not
 * configured, the user's download still works and the failure is only
 * logged. Re-generating a document overwrites the previous copy, so the
 * drive always holds the latest version under the same name.
 *
 * Env (Vercel): SHARED_DRIVE_URL (e.g. https://drive.joostvandenbergh.com),
 * SHARED_DRIVE_USER, SHARED_DRIVE_PASSWORD — a dedicated `studio` WebDAV
 * account, so drive access from the app can be revoked independently.
 */

export type DriveFolder = "Certificates" | "Presentations" | "Docs";

function config() {
  const url = process.env.SHARED_DRIVE_URL;
  const user = process.env.SHARED_DRIVE_USER;
  const pass = process.env.SHARED_DRIVE_PASSWORD;
  if (!url || !user || !pass) return null;
  return {
    base: url.replace(/\/+$/, ""),
    auth: "Basic " + Buffer.from(`${user}:${pass}`).toString("base64"),
  };
}

export async function copyToSharedDrive(
  folder: DriveFolder,
  filename: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<boolean> {
  const cfg = config();
  if (!cfg) return false;
  const target = `${cfg.base}/Downloads/${folder}/${encodeURIComponent(filename)}`;
  const put = () =>
    fetch(target, {
      method: "PUT",
      headers: { Authorization: cfg.auth, "Content-Type": contentType },
      body: bytes as unknown as BodyInit,
      signal: AbortSignal.timeout(8000),
    });
  try {
    let res = await put();
    if (res.status === 404 || res.status === 409) {
      // Parent folder missing (e.g. renamed on the drive) — recreate and retry.
      for (const dir of [`${cfg.base}/Downloads/`, `${cfg.base}/Downloads/${folder}/`]) {
        await fetch(dir, {
          method: "MKCOL",
          headers: { Authorization: cfg.auth },
          signal: AbortSignal.timeout(5000),
        }).catch(() => {});
      }
      res = await put();
    }
    if (!res.ok) {
      console.warn(`shared-drive copy failed: ${res.status} ${target}`);
      return false;
    }
    return true;
  } catch (e) {
    console.warn("shared-drive copy failed:", e instanceof Error ? e.message : e);
    return false;
  }
}

/**
 * Standard response for export routes. The studio UI calls these routes with
 * ?mode=drive: the document is saved onto the shared drive and a small JSON
 * confirmation comes back — no browser download (the drive copy IS the
 * delivery). Without the parameter (direct URL, old bookmarks) the route
 * behaves as a plain attachment download and skips the drive copy.
 */
export async function exportResponse(
  request: Request,
  body: Uint8Array | string,
  contentType: string,
  filename: string,
  folder: DriveFolder,
): Promise<Response> {
  const bytes = typeof body === "string" ? new TextEncoder().encode(body) : body;
  if (new URL(request.url).searchParams.get("mode") === "drive") {
    // mode=drive writes a file to the shared drive — a state change on a GET.
    // CSRF guard: require the custom header the studio's export buttons send.
    // A cross-site attacker can trigger a GET via navigation/img/form (none of
    // which can set custom headers) but a cross-origin fetch that sets one
    // triggers a CORS preflight this endpoint never grants — so the header
    // proves the request came from our own JS. This has no false negatives
    // from a missing Origin/Referer, so every signed-in user can save.
    if (request.headers.get("x-jvb-drive-save") !== "1")
      return Response.json({ ok: false, error: "Save must be triggered from the app" }, { status: 403 });
    if (!config())
      return Response.json(
        { ok: false, error: "Shared drive not configured (SHARED_DRIVE_URL)" },
        { status: 501 },
      );
    const saved = await copyToSharedDrive(folder, filename, bytes, contentType);
    if (!saved)
      return Response.json(
        { ok: false, error: "Could not save to the shared drive" },
        { status: 502 },
      );
    return Response.json({ ok: true, folder, filename });
  }
  return new Response(bytes as unknown as BodyInit, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
