"""Reusable MediaPipe landmark anchors for the body photo.

Exposes a single ``PoseAnchors`` dataclass with resolved pixel coordinates for
every landmark the rest of the app cares about: face (eyes, ears, head top),
shoulders, hips, wrists, ankles and feet. All helpers are best-effort —
when detection fails we fall back to heuristic positions based on the image
size so the pipeline never crashes.

Used by both the stub try-on engine (to anchor torso/leg regions) and the
accessory overlay module (to place sunglasses, hats, shoes, watches, belts).
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field

import numpy as np
from PIL import Image

logger = logging.getLogger(__name__)

Point = tuple[int, int]


@dataclass
class PoseAnchors:
    width: int
    height: int

    # Face (FaceMesh landmark indices in comments)
    left_eye_outer: Point | None = None   # 33
    right_eye_outer: Point | None = None  # 263
    nose_bridge: Point | None = None      # 168
    head_top: Point | None = None         # 10
    left_ear: Point | None = None         # 234
    right_ear: Point | None = None        # 454
    chin: Point | None = None             # 152

    # Body (Pose landmark indices)
    left_shoulder: Point | None = None    # 11
    right_shoulder: Point | None = None   # 12
    left_hip: Point | None = None         # 23
    right_hip: Point | None = None        # 24
    left_wrist: Point | None = None       # 15
    right_wrist: Point | None = None      # 16
    left_elbow: Point | None = None       # 13
    right_elbow: Point | None = None      # 14
    left_ankle: Point | None = None       # 27
    right_ankle: Point | None = None      # 28
    left_foot: Point | None = None        # 31
    right_foot: Point | None = None       # 32

    debug: dict = field(default_factory=dict)

    # ---- derived helpers ----

    @property
    def shoulders_center(self) -> Point:
        if self.left_shoulder and self.right_shoulder:
            return (
                (self.left_shoulder[0] + self.right_shoulder[0]) // 2,
                (self.left_shoulder[1] + self.right_shoulder[1]) // 2,
            )
        return (self.width // 2, int(self.height * 0.25))

    @property
    def hips_center(self) -> Point:
        if self.left_hip and self.right_hip:
            return (
                (self.left_hip[0] + self.right_hip[0]) // 2,
                (self.left_hip[1] + self.right_hip[1]) // 2,
            )
        return (self.width // 2, int(self.height * 0.55))

    @property
    def shoulder_width(self) -> int:
        if self.left_shoulder and self.right_shoulder:
            dx = self.right_shoulder[0] - self.left_shoulder[0]
            dy = self.right_shoulder[1] - self.left_shoulder[1]
            return max(1, int((dx * dx + dy * dy) ** 0.5))
        return self.width // 3

    @property
    def hip_width(self) -> int:
        if self.left_hip and self.right_hip:
            dx = self.right_hip[0] - self.left_hip[0]
            dy = self.right_hip[1] - self.left_hip[1]
            return max(1, int((dx * dx + dy * dy) ** 0.5))
        return self.width // 3

    def torso_box(self) -> tuple[int, int, int, int]:
        """Return (left, top, right, bottom) box covering the torso."""
        sx, sy = self.shoulders_center
        hx, hy = self.hips_center
        half_w = max(self.shoulder_width, self.hip_width) // 2
        pad = int(half_w * 0.15)
        return (
            max(0, sx - half_w - pad),
            max(0, sy - pad),
            min(self.width, sx + half_w + pad),
            min(self.height, hy + pad),
        )

    def legs_box(self) -> tuple[int, int, int, int]:
        """Return (left, top, right, bottom) box covering the legs."""
        hx, hy = self.hips_center
        half_w = max(self.hip_width, self.width // 4) // 2
        pad = int(half_w * 0.2)
        bottom = self.height
        if self.left_ankle and self.right_ankle:
            bottom = max(self.left_ankle[1], self.right_ankle[1])
        return (
            max(0, hx - half_w - pad),
            max(0, hy - pad),
            min(self.width, hx + half_w + pad),
            min(self.height, bottom + pad),
        )


def detect_pose(image: Image.Image) -> PoseAnchors:
    """Run MediaPipe Pose + FaceMesh and return resolved anchors.

    Silently falls back to heuristic positions if either detector fails or
    MediaPipe is not installed, so callers never need to branch.
    """
    rgb = image.convert("RGB")
    w, h = rgb.size
    anchors = PoseAnchors(width=w, height=h)

    try:
        import mediapipe as mp
    except ImportError:
        logger.warning("mediapipe not installed; using heuristic anchors")
        _fill_heuristic(anchors)
        return anchors

    arr = np.array(rgb)

    # ---- Pose ----
    try:
        pose = mp.solutions.pose.Pose(static_image_mode=True, model_complexity=1)
        pose_res = pose.process(arr)
        pose.close()
        if pose_res.pose_landmarks:
            lm = pose_res.pose_landmarks.landmark

            def pt(i: int) -> Point | None:
                p = lm[i]
                # visibility threshold keeps off-screen guesses out
                if getattr(p, "visibility", 1.0) < 0.3:
                    return None
                return (int(p.x * w), int(p.y * h))

            anchors.left_shoulder = pt(11)
            anchors.right_shoulder = pt(12)
            anchors.left_elbow = pt(13)
            anchors.right_elbow = pt(14)
            anchors.left_wrist = pt(15)
            anchors.right_wrist = pt(16)
            anchors.left_hip = pt(23)
            anchors.right_hip = pt(24)
            anchors.left_ankle = pt(27)
            anchors.right_ankle = pt(28)
            anchors.left_foot = pt(31)
            anchors.right_foot = pt(32)
    except Exception as e:  # pragma: no cover - defensive
        logger.warning("pose detection failed: %s", e)

    # ---- FaceMesh ----
    try:
        face = mp.solutions.face_mesh.FaceMesh(
            static_image_mode=True, max_num_faces=1, refine_landmarks=True
        )
        face_res = face.process(arr)
        face.close()
        if face_res.multi_face_landmarks:
            lm = face_res.multi_face_landmarks[0].landmark

            def fpt(i: int) -> Point:
                return (int(lm[i].x * w), int(lm[i].y * h))

            anchors.left_eye_outer = fpt(33)
            anchors.right_eye_outer = fpt(263)
            anchors.nose_bridge = fpt(168)
            anchors.head_top = fpt(10)
            anchors.left_ear = fpt(234)
            anchors.right_ear = fpt(454)
            anchors.chin = fpt(152)
    except Exception as e:  # pragma: no cover - defensive
        logger.warning("face mesh detection failed: %s", e)

    _fill_heuristic(anchors)
    return anchors


def _fill_heuristic(a: PoseAnchors) -> None:
    """Fill any missing anchors with sensible defaults based on image size."""
    w, h = a.width, a.height
    if a.head_top is None:
        a.head_top = (w // 2, int(h * 0.05))
    if a.nose_bridge is None:
        a.nose_bridge = (w // 2, int(h * 0.12))
    if a.chin is None:
        a.chin = (w // 2, int(h * 0.18))
    if a.left_eye_outer is None:
        a.left_eye_outer = (int(w * 0.44), int(h * 0.11))
    if a.right_eye_outer is None:
        a.right_eye_outer = (int(w * 0.56), int(h * 0.11))
    if a.left_shoulder is None:
        a.left_shoulder = (int(w * 0.35), int(h * 0.25))
    if a.right_shoulder is None:
        a.right_shoulder = (int(w * 0.65), int(h * 0.25))
    if a.left_hip is None:
        a.left_hip = (int(w * 0.40), int(h * 0.55))
    if a.right_hip is None:
        a.right_hip = (int(w * 0.60), int(h * 0.55))
    if a.left_wrist is None:
        a.left_wrist = (int(w * 0.28), int(h * 0.55))
    if a.right_wrist is None:
        a.right_wrist = (int(w * 0.72), int(h * 0.55))
    if a.left_ankle is None:
        a.left_ankle = (int(w * 0.43), int(h * 0.93))
    if a.right_ankle is None:
        a.right_ankle = (int(w * 0.57), int(h * 0.93))
    if a.left_foot is None:
        a.left_foot = (int(w * 0.42), int(h * 0.98))
    if a.right_foot is None:
        a.right_foot = (int(w * 0.58), int(h * 0.98))
