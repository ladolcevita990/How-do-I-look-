"use client";

/**
 * Thin wrapper around @imgly/background-removal so components don't have
 * to know about the library shape or cache behaviour.
 *
 * The library is ~40 MB (ONNX model) on first download, but cached in
 * IndexedDB after that. We only import it when the user actually asks
 * for a garment preview — not on initial page load.
 */

let loader: Promise<typeof import("@imgly/background-removal")> | null = null;

function load() {
  if (!loader) {
    loader = import("@imgly/background-removal");
  }
  return loader;
}

export async function removeBackground(
  input: Blob | string,
  onProgress?: (fraction: number) => void
): Promise<Blob> {
  const mod = await load();
  const result = await mod.removeBackground(input, {
    output: { format: "image/png", quality: 0.95 },
    progress: (_key, current, total) => {
      if (onProgress && total > 0) {
        onProgress(current / total);
      }
    },
  });
  return result;
}
