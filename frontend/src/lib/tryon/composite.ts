"use client";

/**
 * Client-side outfit compositor.
 *
 * Ported from backend/app/services/tryon_engine.py (stub backend) and
 * compositing.py. Takes the user's photo plus a list of garment images
 * (already background-removed) and paints them into fixed-proportion
 * regions on top of the body photo. Done entirely in a <canvas> — no
 * backend, no network round-trip.
 *
 * Z-order (bottom to top):
 *   body → lower_body → upper_body → dresses → belt → shoes → tie/scarf →
 *   watch → hat → sunglasses
 *
 * This matches the Python compositing.py layer order so the visual
 * output is consistent whether we composite in Python or JS.
 */

import {
  heuristicAnchors,
  hipsCenter,
  hipWidth,
  legsBox,
  shoulderWidth,
  torsoBox,
  type Box,
  type PoseAnchors,
} from "./pose";

export type Category = "upper_body" | "lower_body" | "dresses" | "shoes" | "accessories";

export type AccessoryType =
  | "sunglasses"
  | "hat"
  | "watch"
  | "belt"
  | "tie"
  | "scarf"
  | "other";

export interface CompositeLayer {
  image: HTMLImageElement;
  category: Category;
  accessoryType: AccessoryType | null;
}

// Render order keyed by layer type.
const LAYER_ORDER: Array<
  | { kind: "clothing"; category: "lower_body" | "upper_body" | "dresses" }
  | { kind: "accessory"; type: AccessoryType | "shoes" }
> = [
  { kind: "clothing", category: "lower_body" },
  { kind: "clothing", category: "upper_body" },
  { kind: "clothing", category: "dresses" },
  { kind: "accessory", type: "belt" },
  { kind: "accessory", type: "shoes" },
  { kind: "accessory", type: "tie" },
  { kind: "accessory", type: "scarf" },
  { kind: "accessory", type: "watch" },
  { kind: "accessory", type: "hat" },
  { kind: "accessory", type: "sunglasses" },
];

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export async function composeOutfit(
  bodyImage: HTMLImageElement,
  layers: CompositeLayer[]
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = bodyImage.naturalWidth;
  canvas.height = bodyImage.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2d context not available");

  ctx.drawImage(bodyImage, 0, 0);

  const anchors = heuristicAnchors(canvas.width, canvas.height);

  // If a dress is present, it replaces both upper and lower like in
  // compositing.py.
  const hasDress = layers.some((l) => l.category === "dresses");
  const filtered = layers.filter((l) => {
    if (hasDress && (l.category === "upper_body" || l.category === "lower_body")) {
      return false;
    }
    return true;
  });

  for (const spec of LAYER_ORDER) {
    for (const layer of filtered) {
      if (spec.kind === "clothing" && layer.category === spec.category) {
        paintClothing(ctx, layer, anchors);
      } else if (
        spec.kind === "accessory" &&
        layer.category === "shoes" &&
        spec.type === "shoes"
      ) {
        paintShoes(ctx, layer, anchors);
      } else if (
        spec.kind === "accessory" &&
        layer.category === "accessories" &&
        layer.accessoryType === spec.type
      ) {
        paintAccessory(ctx, layer, anchors);
      }
    }
  }

  return canvasToBlob(canvas);
}

// ---------------------------------------------------------------------------
// Clothing
// ---------------------------------------------------------------------------

function paintClothing(
  ctx: CanvasRenderingContext2D,
  layer: CompositeLayer,
  anchors: PoseAnchors
) {
  let box: Box;
  if (layer.category === "upper_body") {
    box = torsoBox(anchors);
  } else if (layer.category === "lower_body") {
    box = legsBox(anchors);
  } else {
    // dress — torso + legs merged
    const t = torsoBox(anchors);
    const l = legsBox(anchors);
    box = {
      left: Math.min(t.left, l.left),
      top: t.top,
      right: Math.max(t.right, l.right),
      bottom: l.bottom,
    };
  }
  drawIntoBox(ctx, layer.image, box, 1.0);
}

// ---------------------------------------------------------------------------
// Accessories — ported handlers from backend/app/services/accessory_overlay.py
// ---------------------------------------------------------------------------

function paintAccessory(
  ctx: CanvasRenderingContext2D,
  layer: CompositeLayer,
  anchors: PoseAnchors
) {
  const t = layer.accessoryType;
  if (t === "sunglasses") return paintSunglasses(ctx, layer.image, anchors);
  if (t === "hat") return paintHat(ctx, layer.image, anchors);
  if (t === "watch") return paintWatch(ctx, layer.image, anchors);
  if (t === "belt") return paintBelt(ctx, layer.image, anchors);
  if (t === "tie" || t === "scarf") return paintTieOrScarf(ctx, layer.image, anchors);
  // "other" — paint centred on face as a fallback
  paintSunglasses(ctx, layer.image, anchors);
}

function paintSunglasses(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  a: PoseAnchors
) {
  const leftEye = a.leftEyeOuter;
  const rightEye = a.rightEyeOuter;
  const dx = rightEye.x - leftEye.x;
  const dy = rightEye.y - leftEye.y;
  const eyeDist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
  const angle = Math.atan2(dy, dx);
  const targetW = eyeDist * 2.1;
  const scale = targetW / img.naturalWidth;
  const targetH = img.naturalHeight * scale;
  const cx = (leftEye.x + rightEye.x) / 2;
  const cy = (leftEye.y + rightEye.y) / 2;
  drawRotated(ctx, img, cx, cy, targetW, targetH, angle);
}

function paintHat(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  a: PoseAnchors
) {
  const headW = Math.abs(a.rightEar.x - a.leftEar.x);
  const targetW = Math.max(headW * 1.6, a.width * 0.18);
  const scale = targetW / img.naturalWidth;
  const targetH = img.naturalHeight * scale;
  const cx = a.headTop.x;
  const cy = a.headTop.y - targetH * 0.3;
  drawRotated(ctx, img, cx, cy, targetW, targetH, 0);
}

function paintWatch(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  a: PoseAnchors
) {
  // Paint on the left wrist (user's right hand) — follow forearm angle.
  const wrist = a.leftWrist;
  const elbow = a.leftElbow;
  const angle = Math.atan2(wrist.y - elbow.y, wrist.x - elbow.x) - Math.PI / 2;
  const targetW = shoulderWidth(a) * 0.2;
  const scale = targetW / img.naturalWidth;
  const targetH = img.naturalHeight * scale;
  drawRotated(ctx, img, wrist.x, wrist.y, targetW, targetH, angle);
}

function paintBelt(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  a: PoseAnchors
) {
  const hips = hipsCenter(a);
  const targetW = hipWidth(a) * 1.1;
  const scale = targetW / img.naturalWidth;
  const targetH = img.naturalHeight * scale;
  drawRotated(ctx, img, hips.x, hips.y, targetW, targetH, 0);
}

function paintTieOrScarf(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  a: PoseAnchors
) {
  const targetW = shoulderWidth(a) * 0.35;
  const scale = targetW / img.naturalWidth;
  const targetH = img.naturalHeight * scale;
  const cx = (a.leftShoulder.x + a.rightShoulder.x) / 2;
  const cy = a.chin.y + targetH * 0.5;
  drawRotated(ctx, img, cx, cy, targetW, targetH, 0);
}

// ---------------------------------------------------------------------------
// Shoes — paint both feet
// ---------------------------------------------------------------------------

function paintShoes(
  ctx: CanvasRenderingContext2D,
  layer: CompositeLayer,
  a: PoseAnchors
) {
  const feetPairs: Array<{ ankle: { x: number; y: number }; foot: { x: number; y: number } }> = [
    { ankle: a.leftAnkle, foot: a.leftFoot },
    { ankle: a.rightAnkle, foot: a.rightFoot },
  ];

  const targetW = hipWidth(a) * 0.45;
  const scale = targetW / layer.image.naturalWidth;
  const targetH = layer.image.naturalHeight * scale;

  for (const { ankle, foot } of feetPairs) {
    const dx = foot.x - ankle.x;
    const dy = foot.y - ankle.y;
    const angle = Math.atan2(dy, dx) - Math.PI / 2;
    const cx = (ankle.x + foot.x) / 2;
    const cy = (ankle.y + foot.y) / 2 + targetH * 0.2;
    drawRotated(ctx, layer.image, cx, cy, targetW, targetH, angle);
  }
}

// ---------------------------------------------------------------------------
// Canvas primitives
// ---------------------------------------------------------------------------

function drawIntoBox(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  box: Box,
  alpha: number
) {
  const boxW = box.right - box.left;
  const boxH = box.bottom - box.top;
  if (boxW <= 0 || boxH <= 0) return;

  // Fit while keeping aspect ratio.
  const scale = Math.min(
    boxW / img.naturalWidth,
    boxH / img.naturalHeight
  );
  const drawW = img.naturalWidth * scale;
  const drawH = img.naturalHeight * scale;
  const dx = box.left + (boxW - drawW) / 2;
  const dy = box.top + (boxH - drawH) / 2;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(img, dx, dy, drawW, drawH);
  ctx.restore();
}

function drawRotated(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  cx: number,
  cy: number,
  w: number,
  h: number,
  angle: number
) {
  if (w <= 0 || h <= 0) return;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  ctx.restore();
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Canvas export failed"));
      },
      "image/jpeg",
      0.92
    );
  });
}

// ---------------------------------------------------------------------------
// Helpers for loading remote images into HTMLImageElement
// ---------------------------------------------------------------------------

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

export async function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  try {
    const img = await loadImage(url);
    return img;
  } finally {
    // The caller might still need the URL in the bitmap — but since drawImage
    // has already copied pixels into the canvas by that point, it's safe to
    // revoke later. We leave it to the GC for simplicity.
  }
}
