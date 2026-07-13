import Link from "next/link";

export default function NotFound() {
  return (
    <div className="page flex flex-col items-start py-[var(--section)]">
      <p className="label text-oranje">404</p>
      <h1 className="mt-3 font-sans text-h1 font-medium tracking-tight text-sumi">
        Page not found
      </h1>
      <p className="mt-4 max-w-[var(--measure)] font-serif text-body text-ink-70">
        The page you are looking for doesn&rsquo;t exist or may have been moved.
      </p>
      <Link href="/" className="btn mt-10">
        Back to the gallery
      </Link>
    </div>
  );
}
