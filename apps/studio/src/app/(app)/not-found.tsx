import { OpenSearchButton } from "@/components/command-palette";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";

/**
 * What notFound() shows inside the studio (W16): a record or page that does
 * not exist (a stock number typed wrong, a contact erased, a work in the
 * trash or purged), drawn inside the shell so the nav stays to hand, with
 * the three likely ways on: search, the trash, the dashboard.
 */
export default function AppNotFound() {
  return (
    <div className="max-w-[var(--jvb-measure)]">
      <PageHeader title="Not found" meta="Error 404" />
      <p className="text-[13.5px] leading-[1.5] text-body">
        There is no page at this address. The record may have been deleted or moved to the trash,
        or the link may be mistyped. Search for it, or look in the trash: trashed works stay there
        for 30 days.
      </p>
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <OpenSearchButton>Search the studio</OpenSearchButton>
        <ButtonLink href="/inventory/trash">Open the trash</ButtonLink>
        <ButtonLink href="/" variant="quiet">
          Go to the dashboard
        </ButtonLink>
      </div>
    </div>
  );
}
