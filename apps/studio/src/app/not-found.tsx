import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";

/**
 * An address that matches no route at all (W16). Next.js answers those from
 * the root, outside the (app) group and so outside the shell; this keeps
 * them in the studio's look with a way back in, instead of the framework's
 * bare 404 page. A record that does not exist (notFound() inside a page)
 * gets (app)/not-found.tsx, inside the shell, instead.
 */
export default function RootNotFound() {
  return (
    <>
      <header className="page pt-3">
        <a
          href="/"
          className="text-[15px] font-bold leading-[1.05] tracking-[-0.01em] text-accent hover:text-accent-deep"
        >
          Joost van den Bergh
        </a>
      </header>
      <main className="page py-6 md:py-8">
        <div className="max-w-[var(--jvb-measure)]">
          <PageHeader title="Not found" meta="Error 404" />
          <p className="text-[13.5px] leading-[1.5] text-body">
            There is no page at this address. The link may be mistyped, or the page may have moved.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <ButtonLink href="/" variant="primary">
              Go to the dashboard
            </ButtonLink>
            <ButtonLink href="/inventory">Open the inventory</ButtonLink>
          </div>
        </div>
      </main>
    </>
  );
}
