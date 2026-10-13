"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { PageHeader } from "./ui/page-header";
import { Badge, type Tone } from "./ui/badge";
import { Panel } from "./ui/section";
import { Button } from "./ui/button";
import { Field, Input, Select, Textarea } from "./ui/field";
import { Notice } from "./ui/notice";
import { SaveStatus } from "./ui/save-status";
import { ChevronDownIcon, ChevronUpIcon, CloseIcon, MailIcon, PlusIcon } from "./ui/icons";
import {
  compileNewsletter,
  type Block,
  type NewsletterDesign,
  type WorkItem,
} from "@/lib/newsletter";

/** count: the list's size; eligible: how many a send would actually reach. */
type ListOpt = { id: string; name: string; count: number; eligible: number };

type Props = {
  campaignId: string;
  initialName: string;
  initialSubject: string;
  initialPreview: string;
  initialFrom: string;
  initialListId: string;
  initialDesign: NewsletterDesign;
  lists: ListOpt[];
  defaultFrom: string;
  galleryName: string;
  galleryAddress: string;
  /** Server actions. They read the campaign from the database, so the
   *  designer saves first and only then calls them. */
  sendTest: (formData: FormData) => Promise<void>;
  sendCampaign: () => Promise<void>;
  /** sending: another run holds the send; stale/partial: it can be resumed. */
  sendState: "draft" | "sending" | "stale" | "partial";
  /** The page's banner, shown under the send controls. */
  notice?: ReactNode;
};

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `b${Date.now()}${Math.floor(Math.random() * 1e6)}`;

const BLOCK_PALETTE: { type: Block["type"]; label: string }[] = [
  { type: "heading", label: "Heading" },
  { type: "text", label: "Text" },
  { type: "image", label: "Image" },
  { type: "button", label: "Button" },
  { type: "works", label: "Works" },
  { type: "divider", label: "Divider" },
  { type: "spacer", label: "Spacer" },
];

function blankBlock(type: Block["type"]): Block {
  const id = newId();
  switch (type) {
    case "heading":
      return { id, type, text: "A heading", level: 1 };
    case "text":
      return { id, type, text: "Write something here…" };
    case "image":
      return { id, type, url: "", alt: "" };
    case "button":
      return { id, type, label: "View the works", href: "" };
    case "works":
      return { id, type, items: [{ title: "", maker: "", imageUrl: "", url: "" }] };
    case "divider":
      return { id, type };
    case "spacer":
      return { id, type, size: 20 };
    default:
      return { id, type: "text", text: "" };
  }
}

/**
 * The status in the header, in the words and tones of the newsletters list
 * (crm/campaigns): marked only where the newsletter needs someone.
 */
const SEND_STATE_BADGE: Record<Props["sendState"], { word: string; tone: Tone }> = {
  draft: { word: "Draft", tone: "neutral" },
  sending: { word: "Sending", tone: "info" },
  partial: { word: "Part-sent", tone: "warn" },
  stale: { word: "Part-sent", tone: "warn" },
};

/**
 * Once sending has started the content is fixed, but it must still read
 * back clearly: locked fields are read-only, in ink on the page ground with
 * a quiet rule, rather than disabled (faint text on band, below AA).
 */
const LOCKED = "bg-page hover:bg-page border-b-rule-strong cursor-default resize-none";

/** The palette's words, for the block headings too. */
const BLOCK_LABELS = Object.fromEntries(BLOCK_PALETTE.map((p) => [p.type, p.label])) as Record<
  Block["type"],
  string
>;

export function CampaignDesigner(props: Props) {
  const [name, setName] = useState(props.initialName);
  const [subject, setSubject] = useState(props.initialSubject);
  const [preview, setPreview] = useState(props.initialPreview);
  const [from, setFrom] = useState(props.initialFrom);
  const [listId, setListId] = useState(props.initialListId);
  const [blocks, setBlocks] = useState<Block[]>(props.initialDesign.blocks ?? []);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [actionNote, setActionNote] = useState<string | null>(null);
  const firstRun = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attempt = useRef(0);
  /** Edits not yet in a successful save. */
  const dirty = useRef(false);
  /** The save in flight, so saves run one at a time and a send can wait for it. */
  const inflight = useRef<Promise<boolean> | null>(null);
  // The current values, for saves started by a timer or a button.
  const latest = useRef({ name, subject, preview, from, listId, blocks });
  latest.current = { name, subject, preview, from, listId, blocks };

  const design: NewsletterDesign = useMemo(() => ({ blocks }), [blocks]);

  const html = useMemo(
    () =>
      compileNewsletter(design, {
        galleryName: props.galleryName,
        galleryAddress: props.galleryAddress,
        previewText: preview,
        salutation: "Dear friend",
        unsubscribeUrl: "#",
      }),
    [design, preview, props.galleryName, props.galleryAddress],
  );

  /*
   * Save the current values now. Saves are chained, so an older request can
   * never land after a newer one. A failed save keeps the edits and retries
   * with the same capped backoff as AutosaveForm (2 s, 4 s, 8 s … 30 s);
   * it used to wait for the next edit.
   */
  const save = useCallback((): Promise<boolean> => {
    if (retryTimer.current) {
      clearTimeout(retryTimer.current);
      retryTimer.current = null;
    }
    setStatus("saving");
    const prev = inflight.current;
    const run = (async () => {
      if (prev) await prev;
      dirty.current = false;
      const s = latest.current;
      try {
        const res = await fetch(`/api/crm/campaigns/${props.campaignId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: s.name,
            subject: s.subject,
            preview_text: s.preview,
            from_address: s.from,
            list_id: s.listId || null,
            design: { blocks: s.blocks },
          }),
        });
        if (!res.ok) throw new Error(String(res.status));
        attempt.current = 0;
        // An edit made while this was in flight has its own save coming.
        if (!dirty.current) setStatus("saved");
        return true;
      } catch {
        dirty.current = true;
        setStatus("error");
        attempt.current += 1;
        const delay = Math.min(2000 * 2 ** (attempt.current - 1), 30000);
        if (retryTimer.current) clearTimeout(retryTimer.current);
        retryTimer.current = setTimeout(() => void save(), delay);
        return false;
      }
    })();
    inflight.current = run;
    return run;
  }, [props.campaignId]);

  // Debounced autosave.
  const serialized = JSON.stringify({ name, subject, preview, from, listId, blocks });
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    dirty.current = true;
    setStatus("saving");
    const t = setTimeout(() => {
      timer.current = null;
      void save();
    }, 800);
    timer.current = t;
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serialized]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      if (retryTimer.current) clearTimeout(retryTimer.current);
    },
    [],
  );

  /**
   * Make sure the database holds what is on screen: skip the debounce, wait
   * for any save in flight, and save again if anything is still unsaved.
   * The send actions read the campaign from the database, so Send pressed
   * within the debounce used to mail the design (or list) from before the
   * last edit.
   */
  const flushSave = useCallback(async (): Promise<boolean> => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (inflight.current) await inflight.current;
    return dirty.current ? save() : true;
  }, [save]);

  async function afterSave(action: () => Promise<void>) {
    setActionNote(null);
    if (!(await flushSave())) {
      setActionNote("Nothing was sent: the latest changes have not saved yet. Try again once they have.");
      return;
    }
    await action();
  }

  // The Send button reads the list chosen here, not the one the page was
  // rendered with, and counts only who the send would actually reach.
  const selectedList = props.lists.find((l) => l.id === listId);
  const reach = selectedList?.eligible ?? 0;
  const resuming = props.sendState === "partial" || props.sendState === "stale";
  const busy = props.sendState === "sending";
  const locked = props.sendState !== "draft";

  // Block mutation helpers.
  const patchBlock = (id: string, patch: Partial<Block>) =>
    setBlocks((bs) => bs.map((b) => (b.id === id ? ({ ...b, ...patch } as Block) : b)));
  const removeBlock = (id: string) => setBlocks((bs) => bs.filter((b) => b.id !== id));
  const move = (idx: number, dir: -1 | 1) =>
    setBlocks((bs) => {
      const next = bs.slice();
      const j = idx + dir;
      if (j < 0 || j >= next.length) return bs;
      const a = next[idx];
      const b = next[j];
      if (!a || !b) return bs;
      next[idx] = b;
      next[j] = a;
      return next;
    });
  const addBlock = (type: Block["type"]) => setBlocks((bs) => [...bs, blankBlock(type)]);

  const sendLabel = busy
    ? "Sending…"
    : resuming
      ? `Resume sending (${reach})`
      : `Send to list${listId ? ` (${reach})` : ""}`;

  return (
    <>
      <PageHeader
        back={{ href: "/crm/campaigns", label: "All newsletters" }}
        title={name.trim() || "Untitled newsletter"}
        meta={<Badge tone={SEND_STATE_BADGE[props.sendState].tone}>{SEND_STATE_BADGE[props.sendState].word}</Badge>}
      >
        {/* Test and send: the test address on the left, the one send on the
            right with how many it would reach. */}
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <form
            action={(formData) => afterSave(() => props.sendTest(formData))}
            className="flex flex-wrap items-end gap-2"
          >
            <div className="flex w-full min-w-0 flex-col gap-1 sm:w-56">
              <label htmlFor={`test-email-${props.campaignId}`} className="label">
                Send a test to
              </label>
              <input
                id={`test-email-${props.campaignId}`}
                type="email"
                name="test_email"
                placeholder="you@gallery.com"
                className="field"
              />
            </div>
            <Button type="submit" pendingLabel="Sending…" icon={<MailIcon size={14} />}>
              Send test
            </Button>
          </form>
          <form action={() => afterSave(props.sendCampaign)} className="flex flex-wrap items-center gap-x-3 gap-y-2">
            {listId ? (
              <span className="tabular text-[12px] leading-[1.4] text-meta">
                {resuming
                  ? `Will reach ${reach} more`
                  : `Will reach ${reach} of ${selectedList?.count ?? 0}`}
              </span>
            ) : null}
            <Button
              type="submit"
              variant="primary"
              pendingLabel="Sending…"
              disabled={!listId || busy || (reach === 0 && !resuming)}
              title={
                !listId
                  ? "Choose an audience first"
                  : busy
                    ? "This newsletter is being sent"
                    : `Send to ${reach} recipient${reach === 1 ? "" : "s"} with consent (of ${selectedList?.count ?? 0} on the list)`
              }
            >
              {sendLabel}
            </Button>
          </form>
        </div>
      </PageHeader>

      <div className="space-y-3">
        {actionNote ? <Notice tone="danger">{actionNote}</Notice> : null}
        {props.notice}
      </div>

      <SaveStatus
        sticky={false}
        state={status}
        what="the newsletter"
        onRetry={
          status === "error"
            ? () => {
                attempt.current = 0;
                void save();
              }
            : undefined
        }
        className="mt-3"
      />

      <div className="mt-3 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,560px)]">
        {/* ---- editor column ---- */}
        <div className="min-w-0 space-y-4">
          {/* The name stays editable once a send has started; it is only the
              studio's own label for the newsletter. */}
          <Field label="Newsletter name" hint="For the studio only; readers never see it.">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>

          {/* Once a send has started, the content and audience are fixed:
              those still to be mailed must get what the others got, and the
              per-email send keys depend on it. */}
          {locked ? (
            <Notice tone="warn">
              Sending has started, so the subject, sender, list and design can no longer change. Resume sending mails
              the rest exactly what the others received.
            </Notice>
          ) : null}
          <div className="min-w-0 space-y-4">
            {/* settings */}
            <Panel>
              <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
                <Field label="Subject line">
                  <Input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    readOnly={locked}
                    className={locked ? LOCKED : undefined}
                    placeholder={locked ? undefined : "A new selection of Japanese works"}
                  />
                </Field>
                <Field label="Preview text" hint="Shown after the subject in most inboxes.">
                  <Input
                    value={preview}
                    onChange={(e) => setPreview(e.target.value)}
                    readOnly={locked}
                    className={locked ? LOCKED : undefined}
                  />
                </Field>
                <Field label="Audience list">
                  {locked ? (
                    // A select cannot be read-only, so the fixed choice is
                    // shown as a read-only field with the same words.
                    <Input
                      readOnly
                      className={LOCKED}
                      value={selectedList ? `${selectedList.name} (${selectedList.count})` : "No list chosen"}
                    />
                  ) : (
                    <Select value={listId} onChange={(e) => setListId(e.target.value)}>
                      <option value="">Choose a list</option>
                      {props.lists.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name} ({l.count})
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
                <Field label="From address" hint="Leave empty for the gallery’s usual sender, shown in the box.">
                  <Input
                    // Once locked and left empty, show the gallery's usual sender (the
                    // one the send uses for an empty field) in ink, not as a faint
                    // placeholder. Display only: the saved value stays empty.
                    value={locked && !from ? props.defaultFrom : from}
                    onChange={(e) => setFrom(e.target.value)}
                    readOnly={locked}
                    className={locked ? LOCKED : undefined}
                    placeholder={props.defaultFrom}
                  />
                </Field>
              </div>
            </Panel>

            {/* blocks */}
            <div className="space-y-3">
              {blocks.map((b, idx) => (
                <div key={b.id} className="border border-rule p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h3 className="text-[13px] font-semibold leading-[1.45] text-ink">
                      {BLOCK_LABELS[b.type] ?? b.type}
                    </h3>
                    {/* The arrangement is fixed once sending has started, so
                        the controls that change it are left out. */}
                    <div className={locked ? "hidden" : "flex items-center gap-1"}>
                      <Button
                        iconOnly
                        label="Move up"
                        size="sm"
                        variant="quiet"
                        onClick={() => move(idx, -1)}
                        disabled={idx === 0}
                      >
                        <ChevronUpIcon size={14} />
                      </Button>
                      <Button
                        iconOnly
                        label="Move down"
                        size="sm"
                        variant="quiet"
                        onClick={() => move(idx, 1)}
                        disabled={idx === blocks.length - 1}
                      >
                        <ChevronDownIcon size={14} />
                      </Button>
                      <Button iconOnly label="Remove block" size="sm" variant="quiet" onClick={() => removeBlock(b.id)}>
                        <CloseIcon size={14} />
                      </Button>
                    </div>
                  </div>
                  <BlockEditor block={b} locked={locked} onChange={(patch) => patchBlock(b.id, patch)} />
                </div>
              ))}
              {blocks.length === 0 ? (
                <p className="border border-rule px-3 py-6 text-center text-[13px] leading-[1.45] text-body">
                  This newsletter is empty. Add a block below.
                </p>
              ) : null}
            </div>

            {/* palette */}
            <div
              role="group"
              aria-labelledby={`add-block-${props.campaignId}`}
              className={locked ? "hidden" : "flex flex-wrap items-center gap-1.5"}
            >
              <span id={`add-block-${props.campaignId}`} className="label mr-1">
                Add a block
              </span>
              {BLOCK_PALETTE.map((p) => (
                <Button key={p.type} size="sm" icon={<PlusIcon size={14} />} onClick={() => addBlock(p.type)}>
                  {p.label}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* ---- live preview ----
            Sticks below the header's measured height, not a fixed 64px that
            let the header cover the preview's top. Below lg the box is not
            sticky, so the offset has no effect there. */}
        <div style={{ top: "var(--app-header-h, 88px)" }} className="min-w-0 lg:sticky lg:self-start">
          <p className="label mb-2">Live preview</p>
          {/* White on purpose, in both themes: this is the email as a
              reader's mail program draws it. */}
          <iframe title="Newsletter preview" srcDoc={html} className="h-[640px] w-full border border-rule bg-white" />
        </div>
      </div>
    </>
  );
}

function BlockEditor({
  block,
  locked,
  onChange,
}: {
  block: Block;
  /** Sending has started: every field is read-only. */
  locked: boolean;
  onChange: (patch: Partial<Block>) => void;
}) {
  // What every text field of a locked block takes.
  const ro = locked ? { readOnly: true, className: LOCKED } : {};
  switch (block.type) {
    case "heading":
      return (
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
          <Field label="Heading text">
            <Input {...ro} value={block.text} onChange={(e) => onChange({ text: e.target.value } as Partial<Block>)} />
          </Field>
          <Field label="Size">
            {locked ? (
              <Input {...ro} value={(block.level ?? 1) === 2 ? "Small" : "Large"} />
            ) : (
              <Select
                value={block.level ?? 1}
                onChange={(e) => onChange({ level: Number(e.target.value) as 1 | 2 } as Partial<Block>)}
              >
                <option value={1}>Large</option>
                <option value={2}>Small</option>
              </Select>
            )}
          </Field>
        </div>
      );
    case "text":
      return (
        <Field label="Paragraphs" hint="Leave a blank line to start a new paragraph.">
          <Textarea
            value={block.text}
            onChange={(e) => onChange({ text: e.target.value } as Partial<Block>)}
            rows={4}
            readOnly={locked}
            className={locked ? `font-serif leading-relaxed ${LOCKED}` : "font-serif leading-relaxed"}
          />
        </Field>
      );
    case "image":
      return (
        <div className="grid grid-cols-1 gap-x-2 gap-y-3 sm:grid-cols-2">
          <Field label="Image URL" className="sm:col-span-2">
            <Input
              {...ro}
              value={block.url}
              onChange={(e) => onChange({ url: e.target.value } as Partial<Block>)}
              placeholder={locked ? undefined : "https://"}
            />
          </Field>
          <Field label="Alt text">
            <Input {...ro} value={block.alt ?? ""} onChange={(e) => onChange({ alt: e.target.value } as Partial<Block>)} />
          </Field>
          <Field label="Link URL" optional>
            <Input {...ro} value={block.href ?? ""} onChange={(e) => onChange({ href: e.target.value } as Partial<Block>)} />
          </Field>
        </div>
      );
    case "button":
      return (
        <div className="grid grid-cols-1 gap-x-2 gap-y-3 sm:grid-cols-2">
          <Field label="Button label">
            <Input {...ro} value={block.label} onChange={(e) => onChange({ label: e.target.value } as Partial<Block>)} />
          </Field>
          <Field label="Link URL">
            <Input {...ro} value={block.href} onChange={(e) => onChange({ href: e.target.value } as Partial<Block>)} />
          </Field>
        </div>
      );
    case "spacer":
      return (
        <Field id={`spacer-${block.id}`} label="Height">
          <div className="flex items-center gap-2">
            <input
              id={`spacer-${block.id}`}
              type="range"
              min={4}
              max={80}
              value={block.size ?? 20}
              onChange={(e) => onChange({ size: Number(e.target.value) } as Partial<Block>)}
              disabled={locked}
              className="w-full"
            />
            <span className="tabular w-10 shrink-0 text-[12px] text-body">{block.size ?? 20}px</span>
          </div>
        </Field>
      );
    case "divider":
      return <p className="text-[13px] leading-[1.45] text-body">A horizontal rule.</p>;
    case "works":
      return (
        <WorksEditor items={block.items} locked={locked} onChange={(items) => onChange({ items } as Partial<Block>)} />
      );
    default:
      return null;
  }
}

function WorksEditor({
  items,
  locked,
  onChange,
}: {
  items: WorkItem[];
  locked: boolean;
  onChange: (items: WorkItem[]) => void;
}) {
  const ro = locked ? { readOnly: true, className: LOCKED } : {};
  const patch = (i: number, p: Partial<WorkItem>) =>
    onChange(items.map((it, j) => (j === i ? { ...it, ...p } : it)));
  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={i} className="border-t border-rule pt-2">
          <div className="grid grid-cols-1 gap-x-2 gap-y-3 sm:grid-cols-2">
            <Field label="Title">
              <Input {...ro} value={it.title} onChange={(e) => patch(i, { title: e.target.value })} />
            </Field>
            <Field label="Maker">
              <Input {...ro} value={it.maker ?? ""} onChange={(e) => patch(i, { maker: e.target.value })} />
            </Field>
            <Field label="Image URL">
              <Input {...ro} value={it.imageUrl ?? ""} onChange={(e) => patch(i, { imageUrl: e.target.value })} />
            </Field>
            <Field label="Link URL">
              <Input {...ro} value={it.url ?? ""} onChange={(e) => patch(i, { url: e.target.value })} />
            </Field>
            <Field label="Price or POA" optional>
              <Input {...ro} value={it.price ?? ""} onChange={(e) => patch(i, { price: e.target.value })} />
            </Field>
          </div>
          <div className={locked ? "hidden" : "mt-1.5 text-right"}>
            <Button
              variant="quiet"
              size="sm"
              onClick={() => onChange(items.filter((_, j) => j !== i))}
              aria-label={`Remove work ${i + 1}${it.title ? `, ${it.title}` : ""}`}
            >
              Remove work
            </Button>
          </div>
        </div>
      ))}
      {locked ? null : (
        <Button
          size="sm"
          icon={<PlusIcon size={14} />}
          onClick={() => onChange([...items, { title: "", maker: "", imageUrl: "", url: "" }])}
        >
          Add work
        </Button>
      )}
    </div>
  );
}
