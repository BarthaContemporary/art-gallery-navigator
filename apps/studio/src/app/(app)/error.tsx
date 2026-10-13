"use client";

import { ErrorPanel } from "@/components/error-panel";

/**
 * Segment error boundary for the authenticated app, inside the shell, so the
 * header and nav stay usable. A plain message and the ways out come first;
 * the real error (message, digest, stack) is one click away under Technical
 * details and in Copy details, so failures stay diagnosable in production
 * instead of the opaque "a client-side exception has occurred" screen.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorPanel error={error} reset={reset} />;
}
