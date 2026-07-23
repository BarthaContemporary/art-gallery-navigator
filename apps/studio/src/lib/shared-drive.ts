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
): Promise<void> {
  const cfg = config();
  if (!cfg) return;
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
    if (!res.ok) console.warn(`shared-drive copy failed: ${res.status} ${target}`);
  } catch (e) {
    console.warn("shared-drive copy failed:", e instanceof Error ? e.message : e);
  }
}

/**
 * Standard download response for export routes: serves the file as an
 * attachment and drops a copy onto the shared drive first (bounded by the
 * fetch timeout, so a dead drive delays a download by at most ~8s and
 * never breaks it).
 */
export async function downloadWithDriveCopy(
  body: Uint8Array | string,
  contentType: string,
  filename: string,
  folder: DriveFolder,
): Promise<Response> {
  const bytes = typeof body === "string" ? new TextEncoder().encode(body) : body;
  await copyToSharedDrive(folder, filename, bytes, contentType);
  return new Response(bytes as unknown as BodyInit, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
