import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { SegmentedLinks, ToggleChip } from "@/components/ui/chips";
import { EmptyState } from "@/components/ui/empty-state";
import { Checkbox, Field, Input, Label, Radio, Select, Textarea } from "@/components/ui/field";
import {
  ICONS,
  ArrowRightIcon,
  ChevronLeftIcon,
  CloseIcon,
  DownloadIcon,
  EditIcon,
  FileIcon,
  PlusIcon,
  MoreIcon,
  RefreshIcon,
  SearchIcon,
  TrashIcon,
} from "@/components/ui/icons";
import { Kbd } from "@/components/ui/kbd";
import { MoonGateLoader, MoonGateMark } from "@/components/ui/moon-gate";
import { MenuButton } from "@/components/ui/menu";
import { menuItemClass } from "@/components/ui/menu-class";
import { FlashNotice, Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { Pager } from "@/components/ui/pager";
import { Panel, Section } from "@/components/ui/section";
import { Skeleton, SkeletonTable, SkeletonText } from "@/components/ui/skeleton";
import { Table, TableFrame, Td, Th, Tr } from "@/components/ui/table";
import { WebsiteDot, WebsiteSwitch } from "@/components/ui/website-switch";
import { StatusPill } from "@/components/status-pill";
import { RegisterBadge } from "@/components/register-badge";
import { STATUS_LABELS } from "@/lib/labels";
import {
  DismissibleNotice,
  EmptyTable,
  LiveDeleteListButton,
  LiveWebsiteSwitch,
  ResizableSortableTable,
  SaveStatusLive,
  SaveStatusStates,
  ToggleChips,
  ToneSwatches,
} from "./kit-demos";
import { CollapseStates, ExpandingSearchStates, PendingLive } from "./kit-motion";

/*
 * Dev-only reference page: every shared component (components/ui) in every
 * state, for the visual review to screenshot and for page work to copy from.
 * Hover, press and focus are forced with data-preview (see globals.css).
 * Deliberately no <form> and no named fields, so the form-key guard does not
 * see it. Never served in production.
 */

export const metadata: Metadata = { title: "UI kit" };

function Specimen({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={className ? `min-w-0 ${className}` : "min-w-0"}>
      <p className="mb-1.5 text-[11px] leading-[1.3] text-meta">{label}</p>
      {children}
    </div>
  );
}

const VARIANTS = ["secondary", "primary", "danger", "quiet"] as const;

const INKS = [
  ["ink", "var(--jvb-ink)"],
  ["body", "var(--jvb-body)"],
  ["meta", "var(--jvb-meta)"],
  ["light", "var(--jvb-light)"],
  ["accent", "var(--jvb-accent)"],
  ["accent-deep", "var(--jvb-accent-deep)"],
] as const;
const GROUNDS = [
  ["page", "var(--jvb-page)"],
  ["band / overlay", "var(--jvb-band)"],
  ["field (form)", "var(--jvb-field-bg)"],
  ["form-hover", "var(--jvb-form-hover)"],
  ["accent-wash", "var(--jvb-accent-wash)"],
  ["rule", "var(--jvb-rule)"],
  ["rule-strong", "var(--jvb-rule-strong)"],
  ["field-frame", "var(--jvb-field-frame)"],
  ["field-frame-hover", "var(--jvb-field-frame-hover)"],
] as const;
const TONES = ["neutral", "ok", "warn", "danger", "info"] as const;
const TYPE = [
  ["text-micro", "Micro 11: counters, kbd"],
  ["text-label uppercase text-meta", "Label 11.5: field labels"],
  ["text-caption", "Caption 12: secondary lines"],
  ["text-row", "Row 13: body, cells, buttons"],
  ["text-small", "Small 13.5: inputs, descriptions"],
  ["text-ui font-semibold", "UI 14.5: section headings"],
  ["text-copy", "Copy 16: touch inputs, prose"],
  ["text-title", "Title 22: page headings"],
  ["text-display", "Display 28: record names"],
] as const;

export default function UiKitPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="mx-auto max-w-[1320px] px-4 py-6 md:px-8 md:py-8">
      <PageHeader
        back={{ href: "/", label: "Dashboard" }}
        title="UI kit"
        meta="Dev only. The shared components in components/ui, in every state."
        actions={
          <>
            <Button icon={<DownloadIcon size={14} />}>Export</Button>
            <Button variant="primary" icon={<PlusIcon size={14} />}>
              New record
            </Button>
          </>
        }
      />

      <div className="space-y-6">
        <Section title="Tokens" meta="Four inks, one orange, the grounds and rules. Switch the theme to see the dark ramp.">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="flex flex-wrap gap-3">
              {INKS.map(([name, v]) => (
                <div key={name} className="w-24">
                  <span className="block h-10 border border-rule" style={{ background: v }} />
                  <p className="mt-1 text-[12px] text-body">{name}</p>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-3">
              {GROUNDS.map(([name, v]) => (
                <div key={name} className="w-24">
                  <span className="block h-10 border border-rule-strong" style={{ background: v }} />
                  <p className="mt-1 text-[12px] text-body">{name}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-6">
            <p className="label mb-2">State tones and washes</p>
            <ToneSwatches />
          </div>
          <div className="mt-6 space-y-2">
            {TYPE.map(([cls, text]) => (
              <p key={cls} className={`${cls} text-ink`}>
                {text}
              </p>
            ))}
          </div>
        </Section>

        <Section
          title="Buttons"
          meta="The Moon Gate language: secondary fills with an ink wash, primary is the notched block whose seal stamps in, quiet draws an underline, danger washes red. Rest, hover, pressed, focus, disabled and pending, per variant."
        >
          <div className="space-y-4">
            {VARIANTS.map((variant) => (
              <div key={variant} className="flex flex-wrap items-end gap-x-5 gap-y-3">
                <Specimen label={`${variant.charAt(0).toUpperCase()}${variant.slice(1)}, rest`}>
                  <Button variant={variant}>Save details</Button>
                </Specimen>
                <Specimen label="Hover">
                  <Button variant={variant} data-preview="hover">
                    Save details
                  </Button>
                </Specimen>
                <Specimen label="Pressed">
                  <Button variant={variant} data-preview="active">
                    Save details
                  </Button>
                </Specimen>
                <Specimen label="Focus">
                  <Button variant={variant} data-preview="focus">
                    Save details
                  </Button>
                </Specimen>
                <Specimen label="Disabled">
                  <Button variant={variant} disabled>
                    Save details
                  </Button>
                </Specimen>
                <Specimen label="Pending">
                  <Button variant={variant} pending pendingLabel="Saving…">
                    Save details
                  </Button>
                </Specimen>
              </div>
            ))}
            <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
              <Specimen label="Small">
                <Button size="sm">Add to list</Button>
              </Specimen>
              <Specimen label="Small primary">
                <Button size="sm" variant="primary">
                  Add 3 to list
                </Button>
              </Specimen>
              <Specimen label="With icon">
                <Button icon={<SearchIcon size={14} />}>Search</Button>
              </Specimen>
              <Specimen label="Icon only">
                <Button iconOnly label="Close">
                  <CloseIcon />
                </Button>
              </Specimen>
              <Specimen label="Icon only, small">
                <Button iconOnly size="sm" label="More actions">
                  <MoreIcon size={14} />
                </Button>
              </Specimen>
              <Specimen label="Link">
                <ButtonLink href="/ui-kit">Open record</ButtonLink>
              </Specimen>
              <Specimen label="Link, disabled">
                <ButtonLink href="/ui-kit" disabled>
                  Open record
                </ButtonLink>
              </Specimen>
              <Specimen label="Link, primary">
                <ButtonLink href="/ui-kit" variant="primary" icon={<PlusIcon size={14} />}>
                  New record
                </ButtonLink>
              </Specimen>
              <Specimen label="Wrapping label (wrap)" className="w-56">
                <Button size="sm" wrap>
                  Record: all imported contacts consented in the previous system
                </Button>
              </Specimen>
              <Specimen label="Text links">
                <span className="flex h-[var(--jvb-control-h)] items-center gap-4 text-[13px]">
                  <a href="/ui-kit" className="link">
                    View all
                  </a>
                  <a href="/ui-kit" className="link" data-preview="hover">
                    Edit
                  </a>
                  <a href="/ui-kit" className="link-plain text-ink">
                    Yamamoto Jirō
                  </a>
                </span>
              </Specimen>
            </div>
          </div>
        </Section>

        <Section
          title="Icon buttons"
          meta="Square. On hover each icon makes its own move: a close or a plus turns, an arrow nudges its way, a delete tips, the rest grow a little."
        >
          <div className="space-y-4">
            {VARIANTS.map((variant) => (
              <div key={variant} className="flex flex-wrap items-end gap-x-5 gap-y-3">
                <Specimen label={`${variant.charAt(0).toUpperCase()}${variant.slice(1)}, rest`}>
                  <Button iconOnly variant={variant} label="Close">
                    <CloseIcon />
                  </Button>
                </Specimen>
                <Specimen label="Hover: close">
                  <Button iconOnly variant={variant} label="Close" data-preview="hover">
                    <CloseIcon />
                  </Button>
                </Specimen>
                <Specimen label="Hover: next">
                  <Button iconOnly variant={variant} label="Next" data-preview="hover">
                    <ArrowRightIcon />
                  </Button>
                </Specimen>
                <Specimen label="Hover: previous">
                  <Button iconOnly variant={variant} label="Previous" data-preview="hover">
                    <ChevronLeftIcon />
                  </Button>
                </Specimen>
                <Specimen label="Hover: delete">
                  <Button iconOnly variant={variant} label="Delete" data-preview="hover">
                    <TrashIcon />
                  </Button>
                </Specimen>
                <Specimen label="Hover: edit">
                  <Button iconOnly variant={variant} label="Edit" data-preview="hover">
                    <EditIcon />
                  </Button>
                </Specimen>
                <Specimen label="Hover: other (grows)">
                  <Button iconOnly variant={variant} label="Search" data-preview="hover">
                    <SearchIcon />
                  </Button>
                </Specimen>
                <Specimen label="Small, hover">
                  <Button iconOnly size="sm" variant={variant} label="Refresh" data-preview="hover">
                    <RefreshIcon size={14} />
                  </Button>
                </Specimen>
                <Specimen label="Pressed">
                  <Button iconOnly variant={variant} label="Add" data-preview="active">
                    <PlusIcon />
                  </Button>
                </Specimen>
                <Specimen label="Focus">
                  <Button iconOnly variant={variant} label="Add" data-preview="focus">
                    <PlusIcon />
                  </Button>
                </Specimen>
                <Specimen label="Pending">
                  <Button iconOnly variant={variant} label="Add" pending>
                    <PlusIcon />
                  </Button>
                </Specimen>
              </div>
            ))}
            <Specimen label="Pending, live (click: two seconds on the wire)">
              <PendingLive />
            </Specimen>
          </div>
        </Section>

        <Section
          title="Moon Gate"
          meta="The gallery's mark (mark 4a): an ink square with two square notches, the gate cut out, the seal in the accent. The square takes the text colour."
        >
          <div className="flex flex-wrap items-end gap-x-8 gap-y-5">
            <Specimen label="Mark, 16 / 20 / 28 / 48">
              <span className="flex items-end gap-4 text-ink">
                <MoonGateMark size={16} />
                <MoonGateMark size={20} />
                <MoonGateMark size={28} />
                <MoonGateMark size={48} />
              </span>
            </Specimen>
            <Specimen label="Header (seal pulses once on hover)">
              <span className="mg-hover flex items-center gap-2.5 text-[15px] font-bold leading-[1.05] tracking-[-0.01em] text-accent">
                <MoonGateMark size={20} pulse="hover" className="text-ink" />
                Joost van den Bergh
              </span>
            </Specimen>
            <Specimen label="Quiet (empty states)">
              <MoonGateMark size={28} className="text-rule-strong" />
            </Specimen>
            <Specimen label="Loading (seal breathes)">
              <MoonGateMark size={20} pulse="loop" className="text-ink" />
            </Specimen>
            <Specimen label="Loader, 12 / 14 / 20">
              <span className="flex items-center gap-4 text-ink">
                <MoonGateLoader size={12} />
                <MoonGateLoader size={14} />
                <MoonGateLoader size={20} />
              </span>
            </Specimen>
            <Specimen label="Loader on the primary">
              <span className="inline-flex h-8 items-center bg-ink px-3 text-page">
                <MoonGateLoader size={14} />
              </span>
            </Specimen>
          </div>
        </Section>

        <Section
          title="Destructive actions"
          meta="The first step: danger on its own, quiet in danger inside a row. The confirm step that follows says what goes."
        >
          <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
            <Specimen label="Standalone trigger">
              <Button variant="danger" size="sm">
                Delete list
              </Button>
            </Specimen>
            <Specimen label="Row trigger (quiet, text-danger)">
              <Button variant="quiet" size="sm" className="text-danger">
                Delete
              </Button>
            </Specimen>
            <Specimen label="Confirm step">
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-[12px] leading-[1.4] text-body">Delete &ldquo;Autumn fair&rdquo;?</span>
                <Button variant="danger" size="sm">
                  Yes, delete
                </Button>
                <Button variant="quiet" size="sm">
                  Cancel
                </Button>
              </span>
            </Specimen>
            <Specimen label="DeleteListButton (live)">
              <LiveDeleteListButton />
            </Specimen>
          </div>
        </Section>

        <Section title="Fields" meta="Label above, hint and error below, native controls.">
          <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Title">
              <Input defaultValue="Flower basket, 'Autumn Wind'" />
            </Field>
            <Field label="Title (hover)">
              <Input defaultValue="Flower basket" data-preview="hover" />
            </Field>
            <Field label="Title (focus)">
              <Input defaultValue="Flower basket" data-preview="focus" />
            </Field>
            <Field label="Search" optional>
              <Input placeholder="Stock no., title or maker" />
            </Field>
            <Field label="Marked price £" hint="Whole pounds; commas are fine.">
              <Input defaultValue="12,000" inputMode="decimal" />
            </Field>
            <Field label="Purchase date" error="Enter a date on or before today.">
              <Input type="date" defaultValue="2027-01-04" />
            </Field>
            <Field label="Stock number" hint="Given when the record is created.">
              <Input defaultValue="2026-0014" disabled />
            </Field>
            <Field label="Stock number (read-only)" hint="Shown, selectable, not editable.">
              <Input defaultValue="2026-0014" readOnly />
            </Field>
            <Field label="Purchase date (invalid, focus)" error="Enter a date on or before today.">
              <Input type="date" defaultValue="2027-01-04" data-preview="focus" />
            </Field>
            <Field label="Status (hover)">
              <Select defaultValue="reserved" data-preview="hover">
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Status (focus)">
              <Select defaultValue="sold" data-preview="focus">
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Register (disabled)">
              <Select defaultValue="" disabled>
                <option value="">JvdB stock</option>
              </Select>
            </Field>
            <Field label="Category, is / not (small)" hint="The inventory facets: is, not, hover, unavailable.">
              <span className="flex flex-wrap gap-1">
                <ToggleChip pressed={false} className="field-mode w-10 shrink-0 justify-center px-0">
                  is
                </ToggleChip>
                <ToggleChip pressed className="field-mode w-10 shrink-0 justify-center px-0">
                  not
                </ToggleChip>
                <ToggleChip pressed={false} data-preview="hover" className="field-mode w-10 shrink-0 justify-center px-0">
                  is
                </ToggleChip>
                <ToggleChip pressed={false} disabled className="field-mode w-10 shrink-0 justify-center px-0">
                  is
                </ToggleChip>
              </span>
            </Field>
            <Field label="Location, with its switch (small)">
              <span className="flex gap-1">
                <ToggleChip pressed className="field-mode w-10 shrink-0 justify-center px-0">
                  not
                </ToggleChip>
                <Select fieldSize="sm" defaultValue="sto">
                  <option value="">All locations</option>
                  <option value="sto">Store</option>
                </Select>
              </span>
            </Field>
            <Field label="Status">
              <Select defaultValue="in_stock">
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Location (small)">
              <Select fieldSize="sm" defaultValue="">
                <option value="">All locations</option>
                <option value="sto">Store</option>
              </Select>
            </Field>
            <Field label="Filter (small)">
              <Input fieldSize="sm" placeholder="Filter" />
            </Field>
            <Field label="Native input (wired by Field)" hint="A named field stays a native <input>; Field gives it the id and hint.">
              <input className="field" placeholder="e.g. Kyoto" />
            </Field>
            <Field label="Description" className="sm:col-span-2">
              <Textarea defaultValue="Signed on the base; with a fitted wood box (tomobako) inscribed by the artist." />
            </Field>
            <div className="space-y-2">
              <Label>Choices</Label>
              <Checkbox label="Framed" defaultChecked />
              <Checkbox label="Needs completion" hint="Captured on a phone and not yet catalogued." />
              <Checkbox label="Locked (disabled)" disabled />
            </div>
            <div className="space-y-2">
              <Label>Website square</Label>
              <Radio label="Auto" defaultChecked />
              <Radio label="Flat work" />
              <Radio label="Object" disabled />
            </div>
          </div>
        </Section>

        <Section
          title="Expanding search"
          meta="A field folded to its icon: it opens on a click or /, stays open while it holds a value, Escape folds it when empty and returns focus."
        >
          <ExpandingSearchStates />
        </Section>

        <Section title="Folding" meta="A region that folds on its grid row: Disclosure, or Collapse under a trigger of your own.">
          <CollapseStates />
        </Section>

        <Section
          title="Section"
          meta="The default container: a top rule, a heading, a meta line and actions."
          actions={
            <>
              <a href="/ui-kit" className="link text-[13px]">
                View all
              </a>
              <Button size="sm">Edit</Button>
            </>
          }
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Panel title="Panel" actions={<Button size="sm" variant="quiet">Hide</Button>}>
              <p className="text-[13px] text-body">
                An outlined group inside a page, for the VAT working, the bulk bar or the consignment calculation.
              </p>
            </Panel>
            <Panel compact title="Panel, compact (12px)">
              <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-[13px]">
                <dt className="text-meta">Sold price</dt>
                <dd className="tabular text-right text-body">£14,500.00</dd>
                <dt className="text-meta">less total cost</dt>
                <dd className="tabular text-right text-body">£4,460.00</dd>
                <dt className="text-ink">VAT due (1/6 of margin)</dt>
                <dd className="tabular text-right text-ink">£1,673.33</dd>
              </dl>
            </Panel>
          </div>
        </Section>

        <Section title="Notices" meta="A tone, a rule and words. Danger is announced at once.">
          <div className="space-y-2">
            <Notice tone="info">The sync runs every ten minutes as a fallback.</Notice>
            <Notice tone="ok">Recorded on 3 contacts.</Notice>
            <Notice tone="warn" title="Selection started 2 hours ago">
              Check it is still the set you meant before a bulk change.
            </Notice>
            <Notice tone="danger" action={<Button size="sm" variant="danger">Retry</Button>}>
              Couldn’t publish the list. The website did not answer.
            </Notice>
            <Notice tone="neutral">Nothing has been sent yet.</Notice>
            <div className="flex flex-wrap gap-2">
              <Notice tone="ok" inline>
                Saved
              </Notice>
              <Notice tone="danger" inline>
                Share must be 1 to 99
              </Notice>
            </div>
            <DismissibleNotice />
            <p className="pt-2 text-[12px] text-meta">FlashNotice, from redirect parameters:</p>
            <FlashNotice searchParams={{ error: "A code is required." }} />
            <FlashNotice
              searchParams={{ sent: "41", skipped: "3", failed: "2", reason: "rate_limit_exceeded", left: "12" }}
              codes="campaign"
            />
            <FlashNotice searchParams={{ sent: "nokey" }} codes="offer" />
            <FlashNotice searchParams={{}} fallback={<Notice tone="info">Fallback when the URL carries nothing.</Notice>} />
          </div>
        </Section>

        <Section title="Save status" meta="One line per editor; an error anywhere wins.">
          <div className="grid gap-6 lg:grid-cols-2">
            <SaveStatusStates />
            <div>
              <p className="mb-1.5 text-[11px] text-meta">Live: two sources, one line</p>
              <SaveStatusLive />
            </div>
          </div>
        </Section>

        <Section title="Table" meta="Head in the label style, hairline rows, row states, numeric cells.">
          <TableFrame>
            <Table className="min-w-[720px]">
              <thead>
                <tr>
                  <Th className="w-28" sort="asc" sortHref="/ui-kit">
                    Stock
                  </Th>
                  <Th sort="none" sortHref="/ui-kit">
                    Title
                  </Th>
                  <Th className="w-36">State</Th>
                  <Th className="w-36">Website</Th>
                  <Th className="w-28" numeric sort="desc" sortHref="/ui-kit">
                    Price £
                  </Th>
                </tr>
              </thead>
              <tbody>
                <Tr>
                  <Td className="tabular text-ink">2026-0014</Td>
                  <Td className="text-body">Rest</Td>
                  <Td>
                    <StatusPill status="in_stock" variant="inline" />
                  </Td>
                  <Td>
                    <WebsiteDot on />
                  </Td>
                  <Td numeric>4,200</Td>
                </Tr>
                <Tr data-preview="hover">
                  <Td className="tabular text-ink">2026-0013</Td>
                  <Td className="text-body">Hover</Td>
                  <Td>
                    <StatusPill status="reserved" variant="inline" />
                  </Td>
                  <Td>
                    <WebsiteDot on={false} />
                  </Td>
                  <Td numeric>12,000</Td>
                </Tr>
                <Tr selected>
                  <Td className="tabular text-ink">2026-0012</Td>
                  <Td className="text-body">Selected</Td>
                  <Td>
                    <StatusPill status="consigned_in" variant="inline" />
                  </Td>
                  <Td>
                    <WebsiteDot on />
                  </Td>
                  <Td numeric>860</Td>
                </Tr>
                <Tr current>
                  <Td className="tabular text-ink">2026-0011</Td>
                  <Td className="text-body">Current (j/k)</Td>
                  <Td>
                    <StatusPill status="sold" variant="inline" />
                  </Td>
                  <Td>
                    <WebsiteDot on={false} />
                  </Td>
                  <Td numeric>—</Td>
                </Tr>
                <Tr flagged>
                  <Td className="tabular text-ink">2026-0010</Td>
                  <Td className="text-body">Flagged</Td>
                  <Td>
                    <StatusPill status="returned" variant="inline" />
                  </Td>
                  <Td>
                    <WebsiteDot on wordless />
                  </Td>
                  <Td numeric>1,250</Td>
                </Tr>
                <Tr selected flagged>
                  <Td className="tabular text-ink">2026-0009</Td>
                  <Td className="text-body">Selected and flagged</Td>
                  <Td>
                    <StatusPill status="written_off" variant="inline" />
                  </Td>
                  <Td>
                    <WebsiteDot on={false} wordless />
                  </Td>
                  <Td numeric>0</Td>
                </Tr>
              </tbody>
            </Table>
          </TableFrame>
          <Specimen label="Compact density, tight cells, a wrapping head" className="mt-6">
            <TableFrame>
              <Table density="compact" className="min-w-[480px]">
                <thead>
                  <tr>
                    <Th tight>Stock</Th>
                    <Th tight>Description</Th>
                    <Th tight wrap numeric className="w-24">
                      Purchase £ incl. import VAT
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  <Tr>
                    <Td tight className="tabular text-ink">2026-0014</Td>
                    <Td tight className="text-body">Flower basket, &lsquo;Autumn Wind&rsquo;</Td>
                    <Td tight numeric>
                      4,460.00
                    </Td>
                  </Tr>
                  <Tr>
                    <Td tight className="tabular text-ink">2026-0013</Td>
                    <Td tight className="text-body">Inlaid wooden box</Td>
                    <Td tight numeric>
                      860.00
                    </Td>
                  </Tr>
                </tbody>
              </Table>
            </TableFrame>
          </Specimen>
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Specimen label="Resizable and sortable (client)">
              <ResizableSortableTable />
            </Specimen>
            <Specimen label="Empty">
              <EmptyTable />
            </Specimen>
          </div>
        </Section>

        <Section
          title="Menus, paging and keys"
          meta="A menu is a disclosure: a button with aria-expanded and a panel; Escape or a click outside closes it."
        >
          <div className="flex flex-wrap items-start gap-x-8 gap-y-6">
            <Specimen label="Menu, open" className="min-h-[200px]">
              <MenuButton label="Export" icon={<DownloadIcon size={14} />} align="left" title="Export 108 records" defaultOpen>
                <a href="/ui-kit" className={menuItemClass()}>
                  Spreadsheet (XLSX)
                </a>
                <a href="/ui-kit" className={menuItemClass()}>
                  CSV
                </a>
                <a href="/ui-kit" className={menuItemClass()}>
                  Fact sheets (PDF)
                </a>
              </MenuButton>
            </Specimen>
            <Specimen label="Menu, closed (icon only below lg)">
              <MenuButton label="Documents" icon={<FileIcon size={14} />} collapse="lg">
                <a href="/ui-kit" className={menuItemClass()}>
                  Fact sheet
                </a>
                <a href="/ui-kit" className={menuItemClass()}>
                  Certificate
                </a>
              </MenuButton>
            </Specimen>
            <div className="space-y-4">
              <Specimen label="Pager, first page (start disabled)">
                <Pager page={1} pages={9} href={(p) => `/ui-kit?page=${p}`} label="Pagination, first page" />
              </Specimen>
              <Specimen label="Pager, middle page">
                <Pager page={4} pages={9} href={(p) => `/ui-kit?page=${p}`} label="Pagination, middle page" />
              </Specimen>
              <Specimen label="Pager, last page (end disabled)">
                <Pager page={9} pages={9} href={(p) => `/ui-kit?page=${p}`} label="Pagination, last page" />
              </Specimen>
            </div>
            <Specimen label="Keys">
              <span className="flex h-[var(--jvb-control-h)] items-center gap-2 text-[12px] text-body">
                <Kbd>j</Kbd>
                <Kbd>k</Kbd>
                <Kbd>x</Kbd>
                <span className="text-meta">rows</span>
                <Kbd boxed={false} className="ml-3 text-meta">
                  Ctrl K
                </Kbd>
              </span>
            </Specimen>
          </div>
        </Section>

        <Section title="Badges" meta="A word with a tone: square tags, and dot plus word for rows.">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              {TONES.map((tone) => (
                <Badge key={tone} tone={tone}>
                  {tone.charAt(0).toUpperCase() + tone.slice(1)}
                </Badge>
              ))}
              <Badge caps>Caps</Badge>
              <Badge size="xs" tone="warn" caps>
                Finish
              </Badge>
              <RegisterBadge ledger="external" />
              <RegisterBadge ledger="external" size="xs" />
            </div>
            <div className="flex flex-wrap items-center gap-4">
              {TONES.map((tone) => (
                <Badge key={tone} tone={tone} variant="dot">
                  {tone.charAt(0).toUpperCase() + tone.slice(1)}
                </Badge>
              ))}
              <Badge variant="dot" hollow>
                Not started
              </Badge>
              <span className="w-36 text-[13px]">
                <Badge variant="dot" tone="warn">
                  Awaiting the shipper&rsquo;s reply (wraps)
                </Badge>
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {Object.keys(STATUS_LABELS).map((s) => (
                <StatusPill key={s} status={s} />
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-4">
              {Object.keys(STATUS_LABELS).map((s) => (
                <StatusPill key={s} status={s} variant="inline" />
              ))}
            </div>
          </div>
        </Section>

        <Section title="Chips" meta="Pressed and current are an ink fill, never colour alone.">
          <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
            <Specimen label="Segmented links (current: All)">
              <SegmentedLinks
                aria-label="Register"
                current="all"
                items={[
                  { value: "all", label: "All", href: "/ui-kit", count: 869 },
                  { value: "jvb", label: "JvdB stock", href: "/ui-kit", count: 801 },
                  { value: "external", label: "Not JvdB", href: "/ui-kit", count: 68 },
                ]}
              />
            </Specimen>
            <Specimen label="Toggle, off / hover / on / disabled">
              <div className="flex flex-wrap gap-2">
                <ToggleChip pressed={false}>Flagged</ToggleChip>
                <ToggleChip pressed={false} data-preview="hover">
                  Framed
                </ToggleChip>
                <ToggleChip pressed>Needs purchase £</ToggleChip>
                <ToggleChip pressed={false} disabled>
                  Trash
                </ToggleChip>
              </div>
            </Specimen>
            <Specimen label="Toggle (live)">
              <ToggleChips />
            </Specimen>
          </div>
        </Section>

        <Section title="Website" meta="One mark for works, makers and lists, always with its word.">
          <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
            <Specimen label="Switch, on">
              <WebsiteSwitch on />
            </Specimen>
            <Specimen label="Switch, off">
              <WebsiteSwitch on={false} />
            </Specimen>
            <Specimen label="Switch, named">
              <WebsiteSwitch on onLabel="List on website" />
            </Specimen>
            <Specimen label="Switch, on, hover">
              <WebsiteSwitch on data-preview="hover" />
            </Specimen>
            <Specimen label="Switch, off, focus">
              <WebsiteSwitch on={false} data-preview="focus" />
            </Specimen>
            <Specimen label="Switch, pending">
              <WebsiteSwitch on={false} pending />
            </Specimen>
            <Specimen label="Switch, disabled">
              <WebsiteSwitch on disabled />
            </Specimen>
            <Specimen label="Switch (live)">
              <LiveWebsiteSwitch />
            </Specimen>
            <Specimen label="Dots">
              <span className="flex h-[var(--jvb-control-h)] items-center gap-4">
                <WebsiteDot on />
                <WebsiteDot on={false} />
              </span>
            </Specimen>
          </div>
        </Section>

        <Section title="Empty and loading">
          <div className="grid gap-6 lg:grid-cols-3">
            <Specimen label="Empty state">
              <div className="border border-rule">
                <EmptyState action={<ButtonLink href="/ui-kit" size="sm">New list</ButtonLink>}>
                  No inventory lists yet. A list gathers works for an offer, a fair or labels.
                </EmptyState>
              </div>
            </Specimen>
            <Specimen label="Skeleton text">
              <SkeletonText lines={4} />
              <div className="mt-4 flex gap-3">
                <Skeleton width={96} height={96} />
                <Skeleton width={96} height={96} />
                <Skeleton width={96} height={96} />
              </div>
            </Specimen>
            <Specimen label="Skeleton table">
              <SkeletonTable rows={4} columns={4} />
            </Specimen>
            <Specimen label="App loading state (head)">
              <MoonGateMark size={20} pulse="loop" className="mb-4 block text-ink" />
              <Skeleton width={220} height={24} />
              <Skeleton width={140} height={12} className="mt-2.5" />
            </Specimen>
          </div>
        </Section>

        <Section title="Icons" meta="Tabler outline at stroke 1.7, in the text colour.">
          <ul className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4 lg:grid-cols-6">
            {Object.entries(ICONS).map(([name, Icon]) => (
              <li key={name} className="flex items-center gap-2 text-[12px] text-body">
                <Icon size={18} className="text-ink" />
                {name.replace(/Icon$/, "")}
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </main>
  );
}
