"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RatioImage } from "./ratio-image";
import { EnquiryForm } from "./enquiry-form";
import { ReadMore } from "./read-more";
import { Lightbox } from "./lightbox";
import { imageDimensions, imageUrl, RATIO } from "@/lib/sanity";
import { workCaption, workSubject, type GridWork } from "@/lib/grid-work";

/**
 * Works grid with the fold-out details panel (handoff 2b / 2b2 / 2b3).
 * Clicking a tile opens the panel directly beneath that tile's row; rows
 * below push down; height animates ~350ms ease-out; one panel at a time;
 * the selected tile carries a 2px orange rule on its top edge only.
 * `?work=<id>` is kept in sync so a work can be deep-linked.
 */

const PARAM = "work";

function useColumns(): number {
  const [cols, setCols] = useState(4);
  useEffect(() => {
    const lg = window.matchMedia("(min-width: 1024px)");
    const sm = window.matchMedia("(min-width: 640px)");
    const update = () => setCols(lg.matches ? 4 : sm.matches ? 3 : 2);
    update();
    lg.addEventListener("change", update);
    sm.addEventListener("change", update);
    return () => {
      lg.removeEventListener("change", update);
      sm.removeEventListener("change", update);
    };
  }, []);
  return cols;
}

function readParam(): string | null {
  return new URLSearchParams(window.location.search).get(PARAM);
}

function writeParam(id: string | null) {
  const url = new URL(window.location.href);
  if (id) url.searchParams.set(PARAM, id);
  else url.searchParams.delete(PARAM);
  window.history.replaceState(window.history.state, "", url);
}

export function WorksFoldout({ works, label = "Works" }: { works: GridWork[]; label?: string | null }) {
  const cols = useColumns();
  const [selected, setSelected] = useState<string | null>(null);
  // Panel content stays mounted while it folds closed.
  const [rendered, setRendered] = useState<string | null>(null);
  const [enquiryOpen, setEnquiryOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const tileRefs = useRef(new Map<string, HTMLButtonElement>());
  // A tile in another row, waiting for the open panel to fold closed first.
  const pendingRef = useRef<string | null>(null);
  // Which way the panel's content slides when it swaps within a row.
  const prevIndexRef = useRef(-1);

  const byId = useMemo(() => new Map(works.map((w) => [w.id, w])), [works]);

  // Deep link on arrival.
  useEffect(() => {
    const id = readParam();
    if (id && byId.has(id)) {
      setSelected(id);
      setRendered(id);
    }
  }, [byId]);

  const rowOf = useCallback(
    (id: string) => Math.floor(works.findIndex((w) => w.id === id) / cols),
    [works, cols],
  );

  const select = useCallback(
    (id: string | null) => {
      setEnquiryOpen(false);
      // Moving to another row: close first, open there once the fold has
      // finished (see onTransitionEnd). Same row: the panel stays open and
      // only its content swaps.
      if (id && rendered && selected !== null && rowOf(id) !== rowOf(rendered)) {
        pendingRef.current = id;
        setSelected(null);
        return;
      }
      pendingRef.current = null;
      setSelected(id);
      if (id) setRendered(id);
      writeParam(id);
    },
    [rendered, selected, rowOf],
  );

  // Bring the panel's top into view once it starts opening.
  useEffect(() => {
    if (!selected) return;
    const raf = requestAnimationFrame(() => {
      const el = panelRef.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top;
      const margin = 96;
      if (top < margin || top > window.innerHeight * 0.6) {
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        window.scrollTo({ top: window.scrollY + top - margin, behavior: reduce ? "auto" : "smooth" });
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [selected]);

  const close = useCallback(() => {
    const id = selected;
    select(null);
    if (id) tileRefs.current.get(id)?.focus();
  }, [selected, select]);

  const renderedIndex = rendered ? works.findIndex((w) => w.id === rendered) : -1;
  const swapDir = prevIndexRef.current >= 0 && renderedIndex >= 0 ? Math.sign(renderedIndex - prevIndexRef.current) : 0;
  if (renderedIndex >= 0) prevIndexRef.current = renderedIndex;
  const panelAfter = renderedIndex >= 0 ? Math.min(works.length - 1, Math.floor(renderedIndex / cols) * cols + cols - 1) : -1;
  const panelWork = rendered ? byId.get(rendered) ?? null : null;

  return (
    <div>
      {label ? (
        <div className="flex items-baseline justify-between">
          <h2 className="t-section">{label}</h2>
          <span className="font-sans text-meta text-meta">
            {works.length} {works.length === 1 ? "work" : "works"}
          </span>
        </div>
      ) : null}
      <ul className={`tiles ${label ? "mt-6" : ""}`}>
        {works.map((w, i) => {
          const isSelected = w.id === selected;
          return [
            <li key={w.id}>
              <button
                type="button"
                ref={(el) => {
                  if (el) tileRefs.current.set(w.id, el);
                  else tileRefs.current.delete(w.id);
                }}
                onClick={() => select(isSelected ? null : w.id)}
                aria-expanded={isSelected}
                aria-controls={`work-panel-${w.id}`}
                data-selected={isSelected}
                className="work-tile group relative block w-full text-left"
              >
                <RatioImage
                  image={w.image}
                  ratio={RATIO.work}
                  width={800}
                  alt={workCaption(w)}
                  sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
                />
                <p className="mt-2.5 font-sans text-ui font-medium leading-snug text-ink group-hover:text-accent">
                  {w.artist ?? workCaption(w)}
                </p>
                {w.status ? (
                  <p className="mt-0.5 font-sans text-meta text-meta">{w.status === "sold" ? "Sold" : "Available"}</p>
                ) : null}
              </button>
            </li>,
            i === panelAfter && panelWork ? (
              <li key={`panel-row-${Math.floor(renderedIndex / cols)}`} className="col-span-full">
                <div
                  className="fold"
                  data-open={selected === panelWork.id}
                  onTransitionEnd={(e) => {
                    if (e.target !== e.currentTarget || selected !== null) return;
                    const next = pendingRef.current;
                    if (next) {
                      pendingRef.current = null;
                      setSelected(next);
                      setRendered(next);
                      writeParam(next);
                    } else {
                      setRendered(null);
                    }
                  }}
                >
                  <div id={`work-panel-${panelWork.id}`} aria-hidden={selected !== panelWork.id}>
                    <div ref={panelRef} className="fold-body pt-4 pb-6">
                      <div key={panelWork.id} className="panel-swap" style={{ "--swap-x": `${swapDir * 14}px` } as React.CSSProperties}>
                        <WorkPanel
                          work={panelWork}
                          cols={cols}
                          enquiryOpen={enquiryOpen}
                          onEnquiry={setEnquiryOpen}
                          onClose={close}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            ) : null,
          ];
        })}
      </ul>
    </div>
  );
}

function WorkPanel({
  work,
  cols,
  enquiryOpen,
  onEnquiry,
  onClose,
}: {
  work: GridWork;
  /** Columns of the tile grid above — the panel aligns to the same grid. */
  cols: number;
  enquiryOpen: boolean;
  onEnquiry: (open: boolean) => void;
  onClose: () => void;
}) {
  const caption = workCaption(work);
  // The enquiry form stays mounted while its fold closes (never an empty box).
  const [enquiryMounted, setEnquiryMounted] = useState(enquiryOpen);
  useEffect(() => {
    if (enquiryOpen) setEnquiryMounted(true);
  }, [enquiryOpen]);
  const [lightbox, setLightbox] = useState(false);
  const closeLightbox = useCallback(() => setLightbox(false), []);
  // The panel shows the whole photograph at its own ratio, two tiles wide,
  // on white — never cropped, never letterboxed on grey.
  const large = imageUrl(work.image, { width: 1600 });
  const dims = imageDimensions(work.image);
  const imageSpan = Math.min(2, cols);
  const textSpan = cols > 2 ? cols - 2 : cols;
  const more = [work.provenance ? `Provenance: ${work.provenance}` : null, work.literature ? `Literature: ${work.literature}` : null].filter(
    (s): s is string => s !== null,
  );
  return (
    <div
      className="grid gap-y-6"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, columnGap: "var(--gutter)" }}
    >
      <div className="panel-image self-start bg-page" style={{ gridColumn: `span ${imageSpan}` }}>
        {large && dims ? (
          <>
            <button
              type="button"
              onClick={() => setLightbox(true)}
              aria-label={`View ${caption} full screen`}
              className="block w-full cursor-zoom-in leading-none"
            >
              <Image
                src={large}
                alt={caption}
                width={dims.width}
                height={dims.height}
                sizes="(min-width: 1024px) 50vw, (min-width: 640px) 66vw, 100vw"
                className="h-auto w-full"
              />
            </button>
            {lightbox ? (
              <Lightbox
                src={imageUrl(work.image, { width: 2400, quality: 85 }) ?? large}
                alt={caption}
                width={dims.width}
                height={dims.height}
                onClose={closeLightbox}
              />
            ) : null}
          </>
        ) : null}
      </div>
      <div className="panel-text min-w-0" style={{ gridColumn: `span ${textSpan}` }}>
        <div className="flex items-start justify-between gap-4">
          <p className="font-sans text-body font-medium leading-snug text-ink">
            {work.artist ? (
              <>
                {work.artistSlug ? (
                  <Link href={`/artists/${work.artistSlug}`} className="hover:text-accent">
                    {work.artist}
                  </Link>
                ) : (
                  work.artist
                )}
                {work.artistNative ? <span className="ml-2 font-normal text-light">{work.artistNative}</span> : null}
                {work.artistDates ? <span className="ml-2 font-normal text-meta">({work.artistDates})</span> : null}
              </>
            ) : (
              caption
            )}
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close work details"
            className="-mt-2 -mr-2 inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center font-sans text-[20px] leading-none text-ink hover:text-accent"
          >
            ✕
          </button>
        </div>
        {work.artist ? <p className="mt-2 font-sans text-body text-ink">{caption}</p> : null}
        {work.origin ? <p className="font-sans text-meta text-meta">{work.origin}</p> : null}
        {work.medium ? <p className="font-sans text-meta text-meta">{work.medium}</p> : null}
        {work.dimensions ? <p className="font-sans text-meta text-meta">{work.dimensions}</p> : null}
        {work.description ? (
          <p className="mt-3 max-w-[560px] font-sans text-body text-body">{work.description}</p>
        ) : null}
        {more.length > 0 ? (
          <ReadMore className="mt-1">
            {more.map((line) => (
              <p key={line} className="max-w-[560px] font-sans text-meta text-body">
                {line}
              </p>
            ))}
          </ReadMore>
        ) : null}
        {work.status ? (
          <p className="mt-4 font-sans text-ui text-ink">{work.status === "sold" ? "Sold" : "Available"}</p>
        ) : null}

        <div className="mt-4">
          <div
            className="fold"
            data-open={enquiryOpen}
            onTransitionEnd={(e) => {
              if (e.target === e.currentTarget && !enquiryOpen) setEnquiryMounted(false);
            }}
          >
            <div aria-hidden={!enquiryOpen}>
              <div className="fold-body max-w-[640px] pb-2">
                {enquiryMounted ? (
                  <EnquiryForm
                    kind="work"
                    subject={workSubject(work)}
                    pieceId={work.pieceId}
                    defaultMessage={`I'm interested in ${workSubject(work)}`}
                    heading="Enquire about this work"
                    onCollapse={() => onEnquiry(false)}
                  />
                ) : null}
              </div>
            </div>
          </div>
          {!enquiryOpen ? (
            <button type="button" className="link-accent min-h-[44px]" onClick={() => onEnquiry(true)} aria-expanded={false}>
              Enquire ↓
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
