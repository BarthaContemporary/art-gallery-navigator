"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
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
  /** The back link, shown left of the send controls. */
  header?: ReactNode;
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

const inputCls =
  "w-full rounded-lg border border-line-control bg-control px-2.5 py-1.5 text-[13px] text-ink-body";
const labelCls =
  "block text-[10.5px] font-medium uppercase tracking-[0.06em] text-ink-faint";
const miniBtn =
  "rounded-md border border-line-control bg-control px-1.5 py-0.5 text-[11px] text-ink-mid hover:text-ink-strong disabled:opacity-40";

/** A submit button that disables itself while its form's action runs. */
function PendingSubmit({
  children,
  pendingLabel,
  disabled = false,
  title,
  className,
}: {
  children: ReactNode;
  pendingLabel: string;
  disabled?: boolean;
  title?: string;
  className: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending || disabled} title={title} className={className}>
      {pending ? pendingLabel : children}
    </button>
  );
}

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

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {props.header}
        <div className="flex flex-wrap items-center gap-2">
          <form
            action={(formData) => afterSave(() => props.sendTest(formData))}
            className="flex items-center gap-2"
          >
            <input
              type="email"
              name="test_email"
              placeholder="you@gallery.com"
              className="w-48 rounded-lg border border-line-control bg-control px-2.5 py-1.5 text-[12.5px]"
            />
            <PendingSubmit
              pendingLabel="Sending…"
              className="rounded-lg border border-line-control bg-control px-3 py-1.5 text-[12px] font-medium text-ink-mid hover:text-ink-strong disabled:opacity-50"
            >
              Send test
            </PendingSubmit>
          </form>
          <form action={() => afterSave(props.sendCampaign)} className="flex items-center gap-2">
            {listId ? (
              <span className="text-[12px] text-ink-muted">
                {resuming
                  ? `Will reach ${reach} more`
                  : `Will reach ${reach} of ${selectedList?.count ?? 0}`}
              </span>
            ) : null}
            <PendingSubmit
              pendingLabel="Sending…"
              disabled={!listId || busy || (reach === 0 && !resuming)}
              title={
                !listId
                  ? "Choose an audience first"
                  : busy
                    ? "This newsletter is being sent"
                    : `Send to ${reach} recipient${reach === 1 ? "" : "s"} with consent (of ${selectedList?.count ?? 0} on the list)`
              }
              className="rounded-lg bg-primary px-3.5 py-1.5 text-[12.5px] font-semibold text-primary-fg disabled:opacity-50"
            >
              {busy
                ? "Sending…"
                : resuming
                  ? `Resume sending (${reach})`
                  : `Send to list${listId ? ` (${reach})` : ""}`}
            </PendingSubmit>
          </form>
        </div>
      </div>

      {actionNote ? (
        <p role="alert" className="mt-3 text-[12.5px] text-danger">
          {actionNote}
        </p>
      ) : null}
      {props.notice}

      <div className="mt-4 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,560px)]">
        {/* ---- editor column ---- */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              data-keep-font-size
              className="w-full max-w-[380px] rounded-lg border border-transparent bg-transparent px-0 py-1 text-[18px] font-semibold text-ink-strong focus:border-line-control focus:bg-control focus:px-2"
              aria-label="Newsletter name"
            />
            <span className="flex shrink-0 items-center gap-2 text-[11.5px] text-ink-faint" aria-live="polite">
              {status === "saving"
                ? "Saving…"
                : status === "saved"
                  ? "All changes saved ✓"
                  : status === "error"
                    ? "Couldn’t save. Retrying automatically."
                    : ""}
              {status === "error" ? (
                <button
                  type="button"
                  onClick={() => {
                    attempt.current = 0;
                    void save();
                  }}
                  className={miniBtn}
                >
                  Retry now
                </button>
              ) : null}
            </span>
          </div>

          {/* Once a send has started, the content and audience are fixed:
              those still to be mailed must get what the others got, and the
              per-email send keys depend on it. The name stays editable. */}
          {locked ? (
            <p className="border-l-[3px] border-warn bg-warn-wash px-3 py-2 text-[12.5px] text-body">
              Sending has started, so the subject, sender, list and design can
              no longer change. Resume sending mails the rest exactly what the
              others received.
            </p>
          ) : null}
          <fieldset disabled={locked} className="m-0 min-w-0 space-y-4 border-0 p-0">
          {/* settings */}
          <div className="grid grid-cols-1 gap-3 border border-line bg-cell p-4 sm:grid-cols-2">
            <label className={labelCls}>
              Subject line
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="A new selection of Japanese works"
                className={`mt-1 ${inputCls}`}
              />
            </label>
            <label className={labelCls}>
              Preview text (inbox preheader)
              <input
                value={preview}
                onChange={(e) => setPreview(e.target.value)}
                placeholder="Shown after the subject in most inboxes"
                className={`mt-1 ${inputCls}`}
              />
            </label>
            <label className={labelCls}>
              Audience list
              <select
                value={listId}
                onChange={(e) => setListId(e.target.value)}
                className={`mt-1 ${inputCls}`}
              >
                <option value="">— choose a list —</option>
                {props.lists.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} ({l.count})
                  </option>
                ))}
              </select>
            </label>
            <label className={labelCls}>
              From address
              <input
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                placeholder={props.defaultFrom}
                className={`mt-1 ${inputCls}`}
              />
            </label>
          </div>

          {/* blocks */}
          <div className="space-y-3">
            {blocks.map((b, idx) => (
              <div key={b.id} className="border border-line bg-cell p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[10.5px] font-medium uppercase tracking-[0.06em] text-ink-faint">
                    {b.type}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => move(idx, -1)}
                      disabled={idx === 0}
                      className={miniBtn}
                      aria-label="Move up"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => move(idx, 1)}
                      disabled={idx === blocks.length - 1}
                      className={miniBtn}
                      aria-label="Move down"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => removeBlock(b.id)}
                      className={`${miniBtn} text-ink-soft`}
                      aria-label="Remove block"
                    >
                      ✕
                    </button>
                  </div>
                </div>
                <BlockEditor block={b} onChange={(patch) => patchBlock(b.id, patch)} />
              </div>
            ))}
            {blocks.length === 0 ? (
              <p className="border border-dashed border-line-control px-3 py-6 text-center text-[12.5px] text-ink-muted">
                Empty newsletter — add a block below.
              </p>
            ) : null}
          </div>

          {/* palette */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] uppercase tracking-[0.06em] text-ink-faint">Add</span>
            {BLOCK_PALETTE.map((p) => (
              <button
                key={p.type}
                type="button"
                onClick={() => addBlock(p.type)}
                className="rounded-lg border border-line-control bg-control px-2.5 py-1 text-[12px] font-medium text-ink-mid hover:text-ink-strong"
              >
                + {p.label}
              </button>
            ))}
          </div>
          </fieldset>
        </div>

        {/* ---- live preview ----
            Sticks below the header's measured height, not a fixed 64px that
            let the header cover the preview's top. Below lg the box is not
            sticky, so the offset has no effect there. */}
        <div style={{ top: "var(--app-header-h, 88px)" }} className="lg:sticky lg:self-start">
          <p className="mb-2 text-[11px] uppercase tracking-[0.06em] text-ink-faint">
            Live preview
          </p>
          <iframe
            title="Newsletter preview"
            srcDoc={html}
            className="h-[640px] w-full border border-line bg-white"
          />
        </div>
      </div>
    </>
  );
}

function BlockEditor({
  block,
  onChange,
}: {
  block: Block;
  onChange: (patch: Partial<Block>) => void;
}) {
  switch (block.type) {
    case "heading":
      return (
        <div className="flex items-center gap-2">
          <input
            value={block.text}
            onChange={(e) => onChange({ text: e.target.value } as Partial<Block>)}
            className={inputCls}
            placeholder="Heading text"
          />
          <select
            value={block.level ?? 1}
            onChange={(e) => onChange({ level: Number(e.target.value) as 1 | 2 } as Partial<Block>)}
            className="shrink-0 rounded-lg border border-line-control bg-control px-2 py-1.5 text-[12.5px] text-ink-mid"
          >
            <option value={1}>Large</option>
            <option value={2}>Small</option>
          </select>
        </div>
      );
    case "text":
      return (
        <textarea
          value={block.text}
          onChange={(e) => onChange({ text: e.target.value } as Partial<Block>)}
          rows={4}
          className={`${inputCls} font-serif leading-relaxed`}
          placeholder="Paragraph text. Leave a blank line to start a new paragraph."
        />
      );
    case "image":
      return (
        <div className="space-y-2">
          <input
            value={block.url}
            onChange={(e) => onChange({ url: e.target.value } as Partial<Block>)}
            className={inputCls}
            placeholder="Image URL (https://…)"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              value={block.alt ?? ""}
              onChange={(e) => onChange({ alt: e.target.value } as Partial<Block>)}
              className={inputCls}
              placeholder="Alt text"
            />
            <input
              value={block.href ?? ""}
              onChange={(e) => onChange({ href: e.target.value } as Partial<Block>)}
              className={inputCls}
              placeholder="Link URL (optional)"
            />
          </div>
        </div>
      );
    case "button":
      return (
        <div className="grid grid-cols-2 gap-2">
          <input
            value={block.label}
            onChange={(e) => onChange({ label: e.target.value } as Partial<Block>)}
            className={inputCls}
            placeholder="Button label"
          />
          <input
            value={block.href}
            onChange={(e) => onChange({ href: e.target.value } as Partial<Block>)}
            className={inputCls}
            placeholder="Link URL"
          />
        </div>
      );
    case "spacer":
      return (
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={4}
            max={80}
            value={block.size ?? 20}
            onChange={(e) => onChange({ size: Number(e.target.value) } as Partial<Block>)}
            className="w-full"
          />
          <span className="w-10 shrink-0 font-mono text-[12px] text-ink-muted">
            {block.size ?? 20}px
          </span>
        </div>
      );
    case "divider":
      return <p className="text-[12px] text-ink-muted">A horizontal rule.</p>;
    case "works":
      return <WorksEditor items={block.items} onChange={(items) => onChange({ items } as Partial<Block>)} />;
    default:
      return null;
  }
}

function WorksEditor({
  items,
  onChange,
}: {
  items: WorkItem[];
  onChange: (items: WorkItem[]) => void;
}) {
  const patch = (i: number, p: Partial<WorkItem>) =>
    onChange(items.map((it, j) => (j === i ? { ...it, ...p } : it)));
  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={i} className="rounded-lg border border-line-soft p-2">
          <div className="grid grid-cols-2 gap-2">
            <input
              value={it.title}
              onChange={(e) => patch(i, { title: e.target.value })}
              className={inputCls}
              placeholder="Title"
            />
            <input
              value={it.maker ?? ""}
              onChange={(e) => patch(i, { maker: e.target.value })}
              className={inputCls}
              placeholder="Maker"
            />
            <input
              value={it.imageUrl ?? ""}
              onChange={(e) => patch(i, { imageUrl: e.target.value })}
              className={inputCls}
              placeholder="Image URL"
            />
            <input
              value={it.url ?? ""}
              onChange={(e) => patch(i, { url: e.target.value })}
              className={inputCls}
              placeholder="Link URL"
            />
            <input
              value={it.price ?? ""}
              onChange={(e) => patch(i, { price: e.target.value })}
              className={inputCls}
              placeholder="Price / POA (optional)"
            />
          </div>
          <div className="mt-1.5 text-right">
            <button
              type="button"
              onClick={() => onChange(items.filter((_, j) => j !== i))}
              className="text-[11.5px] text-ink-soft hover:text-ink-strong"
            >
              Remove work
            </button>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, { title: "", maker: "", imageUrl: "", url: "" }])}
        className="rounded-lg border border-line-control bg-control px-2.5 py-1 text-[12px] font-medium text-ink-mid hover:text-ink-strong"
      >
        + Add work
      </button>
    </div>
  );
}
