"use client";

import Image from "next/image";
import { ReactCompareSlider, ReactCompareSliderImage } from "react-compare-slider";
import { getFileUrl } from "@/lib/api";

export default function TryOnResult({
  originalUrl,
  resultUrl,
  loading,
  error,
}: {
  originalUrl: string;
  resultUrl: string | null;
  loading: boolean;
  error?: string | null;
}) {
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
        <svg
          className="w-12 h-12 mx-auto text-red-400 mb-3"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
          />
        </svg>
        <p className="text-red-700 font-medium">Try-on failed</p>
        <p className="text-red-500 text-sm mt-1">{error}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-gray-50 rounded-2xl p-12 text-center">
        <div className="animate-pulse space-y-4">
          <div className="w-20 h-20 mx-auto bg-indigo-100 rounded-full flex items-center justify-center">
            <svg
              className="animate-spin h-8 w-8 text-indigo-500"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          </div>
          <p className="text-indigo-600 font-medium">
            Creating your look...
          </p>
          <p className="text-gray-500 text-sm">
            This usually takes 15-30 seconds per garment
          </p>
        </div>
      </div>
    );
  }

  if (!resultUrl) {
    return (
      <div className="bg-gray-50 rounded-2xl p-12 text-center">
        <Image
          src={originalUrl}
          alt="Your photo"
          width={384}
          height={512}
          className="mx-auto rounded-xl shadow-lg"
        />
        <p className="text-gray-500 text-sm mt-4">
          Add items to your outfit and click &quot;Try On&quot; to see the result
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl overflow-hidden shadow-lg">
        <ReactCompareSlider
          itemOne={
            <ReactCompareSliderImage
              src={originalUrl}
              alt="Original"
            />
          }
          itemTwo={
            <ReactCompareSliderImage
              src={getFileUrl(resultUrl)}
              alt="Try-on result"
            />
          }
          style={{ height: "512px" }}
        />
      </div>

      <div className="flex justify-center gap-3">
        <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
          &larr; Original
        </span>
        <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
          Try-On &rarr;
        </span>
      </div>

      <div className="flex gap-3 justify-center">
        <a
          href={getFileUrl(resultUrl)}
          download="howdoilook-result.jpg"
          className="px-6 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition-colors"
        >
          Download Result
        </a>
      </div>
    </div>
  );
}
