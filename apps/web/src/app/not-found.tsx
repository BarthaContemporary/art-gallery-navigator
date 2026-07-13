import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col items-start px-4 py-24 sm:px-6">
      <p className="font-mono text-xs text-ink-soft">404</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink-strong">
        Page not found
      </h1>
      <p className="mt-3 text-ink-muted">
        The page you are looking for doesn&rsquo;t exist or may have been moved.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex min-h-11 items-center rounded-control border border-line-control bg-control px-6 py-3 text-sm font-medium text-ink transition-colors hover:bg-control-active"
      >
        Back to the gallery
      </Link>
    </div>
  );
}
