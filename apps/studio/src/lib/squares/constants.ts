/** A rectangle in source pixels. */
export type Box = { left: number; top: number; width: number; height: number };

export type PhotographAnalysis = {
  /** True when the photograph shows a subject on a plain studio backdrop (an object); false when it is cropped to the work itself (a flat work). */
  hasBackdrop: boolean;
  /** The subject's bounding box in source pixels, shadow included; the whole photograph when nothing stands out. */
  box: Box;
  /** The subject's body alone, without its cast shadow: what the square is centred on. Equals `box` when no body stands out. */
  body: Box;
  width: number;
  height: number;
  /** Diagnostics: residual noise of the border band (0–255), share of the border the subject touches, mean border luminance. */
  border: { noise: number; touch: number; luminance: number; uniform: boolean };
};

export type ObjectSquare = {
  square: Buffer;
  box: Box;
  /** The square region of the source the tile shows, possibly reaching outside the photograph. */
  canvas: { left: number; top: number; side: number };
  sourceWidth: number;
  sourceHeight: number;
};

/** The subject's larger side as a share of the square (the gallery's rule: 80%). */
export const FILL = 0.8;
/** Margins as shares of the square: top and sides, then the slightly larger bottom. */
export const MARGIN_TOP = 0.09;
export const MARGIN_BOTTOM = 0.11;
/** The least margin kept around the subject's shadow, so it is never cut by the square. */
export const SHADOW_MARGIN = 0.04;
/** Pixels across the rendered square. */
export const SQUARE_PX = 1600;
