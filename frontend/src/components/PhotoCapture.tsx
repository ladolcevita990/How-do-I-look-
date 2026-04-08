"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Webcam from "react-webcam";
import { useDropzone } from "react-dropzone";
import { useUpload } from "@/hooks/useUpload";

type Mode = "choose" | "webcam" | "upload";

function useIsMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 768px)");
    const handler = () => setMobile(mq.matches);
    handler();
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return mobile;
}

export default function PhotoCapture({
  onComplete,
}: {
  onComplete: () => void;
}) {
  const [mode, setMode] = useState<Mode>("choose");
  const webcamRef = useRef<Webcam>(null);
  const { upload, uploading, error } = useUpload();
  const isMobile = useIsMobile();

  const handleFile = useCallback(
    async (file: File) => {
      try {
        await upload(file);
        onComplete();
      } catch {
        // error state is set inside useUpload
      }
    },
    [upload, onComplete]
  );

  const onDrop = useCallback(
    (files: File[]) => {
      if (files[0]) handleFile(files[0]);
    },
    [handleFile]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/jpeg": [], "image/png": [], "image/webp": [] },
    maxSize: 10 * 1024 * 1024,
    multiple: false,
  });

  const capturePhoto = useCallback(async () => {
    if (!webcamRef.current) return;
    const imageSrc = webcamRef.current.getScreenshot();
    if (!imageSrc) return;
    const res = await fetch(imageSrc);
    const blob = await res.blob();
    const file = new File([blob], "capture.jpg", { type: "image/jpeg" });
    handleFile(file);
  }, [handleFile]);

  // ---- choose ----
  if (mode === "choose") {
    return (
      <div className="max-w-xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-serif font-semibold text-neutral-900">
            Your body, your canvas
          </h2>
          <p className="text-neutral-600">
            We&apos;ll use one full-body photo to show how every outfit looks on
            you. It stays on your device.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            onClick={() => setMode("webcam")}
            className="flex flex-col items-center gap-3 p-8 bg-white rounded-2xl border border-neutral-200 hover:border-neutral-900 hover:shadow-lg transition-all"
          >
            <svg
              className="w-10 h-10 text-neutral-900"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
            <span className="font-medium text-neutral-900">
              {isMobile ? "Take a photo" : "Use webcam"}
            </span>
            <span className="text-sm text-neutral-500">
              {isMobile ? "With your phone camera" : "Capture directly"}
            </span>
          </button>

          <button
            onClick={() => setMode("upload")}
            className="flex flex-col items-center gap-3 p-8 bg-white rounded-2xl border border-neutral-200 hover:border-neutral-900 hover:shadow-lg transition-all"
          >
            <svg
              className="w-10 h-10 text-neutral-900"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <span className="font-medium text-neutral-900">Upload image</span>
            <span className="text-sm text-neutral-500">From your device</span>
          </button>
        </div>
      </div>
    );
  }

  // ---- webcam ----
  if (mode === "webcam") {
    return (
      <div className="max-w-xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setMode("choose")}
            className="text-neutral-500 hover:text-neutral-900 text-sm"
          >
            &larr; Back
          </button>
          <h2 className="text-lg font-semibold text-neutral-900">
            Strike a pose
          </h2>
          <div className="w-12" />
        </div>

        <div className="relative rounded-2xl overflow-hidden bg-black aspect-[3/4]">
          <Webcam
            ref={webcamRef}
            screenshotFormat="image/jpeg"
            screenshotQuality={0.95}
            videoConstraints={{
              facingMode: isMobile ? "environment" : "user",
              aspectRatio: 3 / 4,
            }}
            className="w-full h-full object-cover"
          />
          {/* Pose guide overlay */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <svg
              viewBox="0 0 200 400"
              className="h-[85%] opacity-30"
              fill="none"
              stroke="white"
              strokeWidth="1.5"
            >
              <ellipse cx="100" cy="45" rx="25" ry="30" />
              <line x1="100" y1="75" x2="100" y2="220" />
              <line x1="100" y1="100" x2="55" y2="190" />
              <line x1="100" y1="100" x2="145" y2="190" />
              <line x1="100" y1="220" x2="70" y2="370" />
              <line x1="100" y1="220" x2="130" y2="370" />
            </svg>
          </div>
        </div>

        <p className="text-xs text-neutral-500 text-center">
          Full body in frame · face forward · arms slightly away from body ·
          good light
        </p>

        <button
          onClick={capturePhoto}
          disabled={uploading}
          className="w-full py-3 px-6 bg-neutral-900 text-white font-semibold rounded-xl hover:bg-neutral-800 disabled:opacity-50 transition-colors"
        >
          {uploading ? "Processing…" : "Capture photo"}
        </button>

        {error && (
          <p className="text-red-600 text-sm text-center">{error}</p>
        )}
      </div>
    );
  }

  // ---- upload ----
  return (
    <div className="max-w-xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setMode("choose")}
          className="text-neutral-500 hover:text-neutral-900 text-sm"
        >
          &larr; Back
        </button>
        <h2 className="text-lg font-semibold text-neutral-900">
          Upload image
        </h2>
        <div className="w-12" />
      </div>

      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-colors ${
          isDragActive
            ? "border-neutral-900 bg-neutral-100"
            : "border-neutral-300 hover:border-neutral-900"
        }`}
      >
        <input {...getInputProps()} />
        <svg
          className="w-12 h-12 mx-auto text-neutral-400 mb-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
          />
        </svg>
        {uploading ? (
          <p className="text-neutral-900 font-medium">Processing your photo…</p>
        ) : isDragActive ? (
          <p className="text-neutral-900 font-medium">Drop your photo here</p>
        ) : (
          <>
            <p className="text-neutral-900 font-medium">
              Drag & drop your photo here
            </p>
            <p className="text-neutral-500 text-sm mt-1">
              or click to browse (JPEG, PNG, max 10MB)
            </p>
          </>
        )}
      </div>

      {error && <p className="text-red-600 text-sm text-center">{error}</p>}
    </div>
  );
}
