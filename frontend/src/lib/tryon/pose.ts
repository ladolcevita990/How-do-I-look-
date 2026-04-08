/**
 * Fixed-proportion pose anchors for a full-body photo.
 *
 * This is a simplified port of backend/app/services/pose_anchors.py. We
 * skip running MediaPipe in the browser for MVP size / speed reasons and
 * fall back to the heuristic positions directly, assuming the user took
 * the photo with the PhotoCapture pose guide visible (face forward, full
 * body in frame, arms slightly away from body).
 *
 * All coordinates are in pixels relative to the original image.
 */

export interface Point {
  x: number;
  y: number;
}

export interface PoseAnchors {
  width: number;
  height: number;

  // Face
  leftEyeOuter: Point;
  rightEyeOuter: Point;
  noseBridge: Point;
  headTop: Point;
  leftEar: Point;
  rightEar: Point;
  chin: Point;

  // Body
  leftShoulder: Point;
  rightShoulder: Point;
  leftHip: Point;
  rightHip: Point;
  leftWrist: Point;
  rightWrist: Point;
  leftElbow: Point;
  rightElbow: Point;
  leftAnkle: Point;
  rightAnkle: Point;
  leftFoot: Point;
  rightFoot: Point;
}

export function heuristicAnchors(width: number, height: number): PoseAnchors {
  const w = width;
  const h = height;
  return {
    width: w,
    height: h,

    headTop: { x: w * 0.5, y: h * 0.05 },
    noseBridge: { x: w * 0.5, y: h * 0.12 },
    chin: { x: w * 0.5, y: h * 0.18 },
    leftEyeOuter: { x: w * 0.44, y: h * 0.11 },
    rightEyeOuter: { x: w * 0.56, y: h * 0.11 },
    leftEar: { x: w * 0.42, y: h * 0.12 },
    rightEar: { x: w * 0.58, y: h * 0.12 },

    leftShoulder: { x: w * 0.35, y: h * 0.25 },
    rightShoulder: { x: w * 0.65, y: h * 0.25 },
    leftHip: { x: w * 0.4, y: h * 0.55 },
    rightHip: { x: w * 0.6, y: h * 0.55 },
    leftElbow: { x: w * 0.3, y: h * 0.4 },
    rightElbow: { x: w * 0.7, y: h * 0.4 },
    leftWrist: { x: w * 0.28, y: h * 0.55 },
    rightWrist: { x: w * 0.72, y: h * 0.55 },
    leftAnkle: { x: w * 0.43, y: h * 0.93 },
    rightAnkle: { x: w * 0.57, y: h * 0.93 },
    leftFoot: { x: w * 0.42, y: h * 0.98 },
    rightFoot: { x: w * 0.58, y: h * 0.98 },
  };
}

export type Box = { left: number; top: number; right: number; bottom: number };

export function shouldersCenter(a: PoseAnchors): Point {
  return {
    x: (a.leftShoulder.x + a.rightShoulder.x) / 2,
    y: (a.leftShoulder.y + a.rightShoulder.y) / 2,
  };
}

export function hipsCenter(a: PoseAnchors): Point {
  return {
    x: (a.leftHip.x + a.rightHip.x) / 2,
    y: (a.leftHip.y + a.rightHip.y) / 2,
  };
}

export function shoulderWidth(a: PoseAnchors): number {
  const dx = a.rightShoulder.x - a.leftShoulder.x;
  const dy = a.rightShoulder.y - a.leftShoulder.y;
  return Math.max(1, Math.sqrt(dx * dx + dy * dy));
}

export function hipWidth(a: PoseAnchors): number {
  const dx = a.rightHip.x - a.leftHip.x;
  const dy = a.rightHip.y - a.leftHip.y;
  return Math.max(1, Math.sqrt(dx * dx + dy * dy));
}

export function torsoBox(a: PoseAnchors): Box {
  const s = shouldersCenter(a);
  const h = hipsCenter(a);
  const halfW = Math.max(shoulderWidth(a), hipWidth(a)) / 2;
  const pad = halfW * 0.15;
  return {
    left: Math.max(0, s.x - halfW - pad),
    top: Math.max(0, s.y - pad),
    right: Math.min(a.width, s.x + halfW + pad),
    bottom: Math.min(a.height, h.y + pad),
  };
}

export function legsBox(a: PoseAnchors): Box {
  const h = hipsCenter(a);
  const halfW = Math.max(hipWidth(a), a.width / 4) / 2;
  const pad = halfW * 0.2;
  const bottom = Math.max(a.leftAnkle.y, a.rightAnkle.y);
  return {
    left: Math.max(0, h.x - halfW - pad),
    top: Math.max(0, h.y - pad),
    right: Math.min(a.width, h.x + halfW + pad),
    bottom: Math.min(a.height, bottom + pad),
  };
}
