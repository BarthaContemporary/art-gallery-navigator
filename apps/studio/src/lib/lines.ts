/**
 * The posted value of a RepeatableList (Publications, Past exhibitions): a
 * JSON array of the lines, each trimmed, empty lines dropped. The inventory
 * PATCH route (jsonList) and the savePiece action (jsonStringArray) read
 * exactly this shape.
 */
export function serialiseLines(rows: readonly string[]): string {
  return JSON.stringify(rows.map((r) => r.trim()).filter(Boolean));
}
