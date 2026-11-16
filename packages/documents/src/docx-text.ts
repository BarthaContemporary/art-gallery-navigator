import { TextRun, type IRunOptions } from "docx";

/*
 * Multi-line text for the DOCX exports. A newline inside a run's text is
 * written into <w:t> as is, and Word, Pages and Proton Docs show it as a
 * space, so a three-paragraph description came out as one. One run per line
 * instead, each after the first starting with a line break (<w:br/>), all
 * with the same formatting; blank lines become consecutive breaks, so the
 * gaps between paragraphs survive. The paragraph and its spacing stay as
 * they were. Browsers send textarea values with CRLF, hence \r\n and \r.
 */

export function splitLines(text: string): string[] {
  return text.split(/\r\n?|\n/);
}

export function textRuns(text: string, options: Omit<IRunOptions, "text" | "break" | "children"> = {}): TextRun[] {
  return splitLines(text).map((line, i) => new TextRun({ ...options, text: line, ...(i > 0 ? { break: 1 } : {}) }));
}
