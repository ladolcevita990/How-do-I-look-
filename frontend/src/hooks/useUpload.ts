"use client";

import { useState } from "react";
import { uploadPhoto } from "@/lib/api";
import { useAppStore } from "@/lib/store";
import { getFileUrl } from "@/lib/api";

export function useUpload() {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setPhoto = useAppStore((s) => s.setPhoto);

  const upload = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const res = await uploadPhoto(file);
      const photoUrl = getFileUrl(`/api/files/photos/${res.photo_id}/resized.jpg`);
      setPhoto(res.photo_id, photoUrl);
      return res;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Upload failed";
      setError(msg);
      throw e;
    } finally {
      setUploading(false);
    }
  };

  return { upload, uploading, error };
}
