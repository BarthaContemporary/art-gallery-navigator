"use client";

import { planSquare, type Geo } from "@/lib/capture-values";

export type { Geo };

/**
 * Square up a photographed page: crop it to the paper (a box the model gave
 * in fractions of the photo as shown) and turn the crop upright (the model's
 * clockwise angle). Runs on a canvas in the browser — no server image lib.
 * Returns a JPEG File, or null when there is nothing to do, the geometry is
 * unusable or the result would be too small (lib/capture-values.ts
 * planSquare); the caller then keeps the original.
 */
export async function squareUp(file: File, geo: Geo): Promise<File | null> {
  try {
    const img = await loadImage(file);
    const plan = planSquare(geo, img.naturalWidth, img.naturalHeight);
    if (!plan) return null;

    const canvas = document.createElement("canvas");
    canvas.width = plan.outW;
    canvas.height = plan.outH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, plan.outW, plan.outH);
    ctx.translate(plan.outW / 2, plan.outH / 2);
    ctx.rotate(plan.rad);
    ctx.drawImage(img, plan.sx, plan.sy, plan.sw, plan.sh, -plan.sw / 2, -plan.sh / 2, plan.sw, plan.sh);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    if (!blob) return null;
    return new File([blob], file.name.replace(/\.\w+$/, "") + "-squared.jpg", { type: "image/jpeg" });
  } catch {
    return null;
  }
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve(img);
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("bad image"));
    };
    img.src = url;
  });
}
