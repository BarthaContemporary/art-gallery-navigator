import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { levenshtein } from "./levenshtein.js";

export interface ManifestEntry {
  filename: string;
  relative_path: string;
  bytes: number;
  sha256: string;
}

/** Recursively walk a directory, hashing every regular file. */
export async function scanImages(rootDir: string): Promise<ManifestEntry[]> {
  const entries: ManifestEntry[] = [];
  const walk = async (dir: string): Promise<void> => {
    const dirents = fs.readdirSync(dir, { withFileTypes: true });
    for (const dirent of dirents) {
      const full = path.join(dir, dirent.name);
      if (dirent.isDirectory()) {
        await walk(full);
      } else if (dirent.isFile()) {
        entries.push({
          filename: dirent.name,
          relative_path: path.relative(rootDir, full),
          bytes: fs.statSync(full).size,
          sha256: await sha256File(full),
        });
      }
    }
  };
  await walk(rootDir);
  return entries.sort((a, b) => a.relative_path.localeCompare(b.relative_path));
}

function sha256File(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    fs.createReadStream(filePath)
      .on("data", (d) => hash.update(d))
      .on("end", () => resolve(hash.digest("hex")))
      .on("error", reject);
  });
}

export type MatchType =
  | "exact"
  | "case_insensitive"
  | "fuzzy"
  | "ambiguous"
  | "unmatched";

export interface ImageMatch {
  match_type: MatchType;
  matched_path: string | null;
  candidates: number;
}

function stem(filename: string): string {
  const base = path.basename(filename);
  const dot = base.lastIndexOf(".");
  return (dot > 0 ? base.slice(0, dot) : base).toLowerCase();
}

/**
 * Match a legacy container filename against the manifest:
 * exact → case-insensitive → fuzzy (case/extension-insensitive, then
 * Levenshtein ≤ 2 on the basename stem). Multiple equally good candidates
 * → 'ambiguous' (largest file reported as matched_path).
 */
export function matchFilename(
  containerFilename: string,
  manifest: ManifestEntry[],
): ImageMatch {
  const wanted = path.basename(containerFilename.trim());

  const exact = manifest.filter((m) => m.filename === wanted);
  if (exact.length === 1) {
    return { match_type: "exact", matched_path: exact[0]!.relative_path, candidates: 1 };
  }
  if (exact.length > 1) return ambiguous(exact);

  const wantedLower = wanted.toLowerCase();
  const ci = manifest.filter((m) => m.filename.toLowerCase() === wantedLower);
  if (ci.length === 1) {
    return { match_type: "case_insensitive", matched_path: ci[0]!.relative_path, candidates: 1 };
  }
  if (ci.length > 1) return ambiguous(ci);

  const wantedStem = stem(wanted);
  const stemHits = manifest.filter((m) => stem(m.filename) === wantedStem);
  if (stemHits.length === 1) {
    return { match_type: "fuzzy", matched_path: stemHits[0]!.relative_path, candidates: 1 };
  }
  if (stemHits.length > 1) return ambiguous(stemHits);

  let best: { entry: ManifestEntry; distance: number }[] = [];
  for (const m of manifest) {
    const dist = levenshtein(stem(m.filename), wantedStem);
    if (dist > 2) continue;
    if (best.length === 0 || dist < best[0]!.distance) {
      best = [{ entry: m, distance: dist }];
    } else if (dist === best[0]!.distance) {
      best.push({ entry: m, distance: dist });
    }
  }
  if (best.length === 1) {
    return { match_type: "fuzzy", matched_path: best[0]!.entry.relative_path, candidates: 1 };
  }
  if (best.length > 1) return ambiguous(best.map((b) => b.entry));

  return { match_type: "unmatched", matched_path: null, candidates: 0 };
}

function ambiguous(candidates: ManifestEntry[]): ImageMatch {
  const largest = [...candidates].sort((a, b) => b.bytes - a.bytes)[0]!;
  return {
    match_type: "ambiguous",
    matched_path: largest.relative_path,
    candidates: candidates.length,
  };
}
