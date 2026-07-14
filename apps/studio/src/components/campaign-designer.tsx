"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  compileNewsletter,
  type Block,
  type NewsletterDesign,
  type WorkItem,
} from "@/lib/newsletter";

type ListOpt = { id: string; name: string; count: number };

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

export function CampaignDesigner(props: Props) {
  const [name, setName] = useState(props.initialName);
  const [subject, setSubject] = useState(props.initialSubject);
  const [preview, setPreview] = useState(props.initialPreview);
  const [from, setFrom] = useState(props.initialFrom);
  const [listId, setListId] = useState(props.initialListId);
  const [blocks, setBlocks] = useState<Block[]>(props.initialDesign.blocks ?? []);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const firstRun = useRef(true);

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

  // Debounced autosave.
  const serialized = JSON.stringify({ name, subject, preview, from, listId, blocks });
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    setStatus("saving");
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/crm/campaigns/${props.campaignId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name,
            subject,
            preview_text: preview,
            from_address: from,
            list_id: listId || null,
            design: { blocks },
          }),
        });
        setStatus(res.ok ? "saved" : "error");
      } catch {
        setStatus("error");
      }
    }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serialized]);

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
    <div className="mt-4 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,560px)]">
      {/* ---- editor column ---- */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full max-w-[380px] rounded-lg border border-transparent bg-transparent px-0 py-1 text-[18px] font-semibold text-ink-strong focus:border-line-control focus:bg-control focus:px-2"
            aria-label="Newsletter name"
          />
          <span className="shrink-0 text-[11.5px] text-ink-faint">
            {status === "saving"
              ? "Saving…"
              : status === "saved"
                ? "All changes saved ✓"
                : status === "error"
                  ? "Save failed — retrying on next edit"
                  : ""}
          </span>
        </div>

        {/* settings */}
        <div className="grid grid-cols-1 gap-3 rounded-[11px] border border-line bg-cell p-4 sm:grid-cols-2">
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
            <div key={b.id} className="rounded-[11px] border border-line bg-cell p-3">
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
            <p className="rounded-[11px] border border-dashed border-line-control px-3 py-6 text-center text-[12.5px] text-ink-muted">
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
      </div>

      {/* ---- live preview ---- */}
      <div className="lg:sticky lg:top-[64px] lg:self-start">
        <p className="mb-2 text-[11px] uppercase tracking-[0.06em] text-ink-faint">
          Live preview
        </p>
        <iframe
          title="Newsletter preview"
          srcDoc={html}
          className="h-[640px] w-full rounded-[11px] border border-line bg-white"
        />
      </div>
    </div>
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
