"use client";

import { useRef, useState } from "react";
import { Camera, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import api, { getApiErrorMessage } from "@/lib/api/client";

/**
 * Photo proof picker: uploads each chosen/captured image and shows it as a
 * removable thumbnail. `value` is the list of uploaded URLs.
 */
export function ProofPhotosInput({ value, onChange, disabled = false }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  async function upload(files) {
    setUploading(true);
    try {
      const urls = [];
      for (const file of files) {
        const fd = new FormData();
        fd.append("file", file);
        const { data } = await api.post("/uploads", fd, { headers: { "Content-Type": "multipart/form-data" } });
        urls.push(data.photoUrl);
      }
      onChange([...value, ...urls]);
    } catch (e) {
      toast.error(getApiErrorMessage(e, "Photo upload failed"));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {value.map((url) => (
        <div key={url} className="relative h-14 w-14 overflow-hidden rounded-md border">
          <a href={url} target="_blank" rel="noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="Transfer proof" className="h-full w-full object-cover" />
          </a>
          {!disabled && (
            <button
              type="button"
              aria-label="Remove photo"
              onClick={() => onChange(value.filter((u) => u !== url))}
              className="absolute right-0.5 top-0.5 rounded-full bg-background/90 p-0.5 shadow"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      ))}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={(e) => e.target.files?.length && upload([...e.target.files])}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || uploading}
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Camera className="h-4 w-4 mr-1.5" />}
        {value.length ? "Add photo" : "Upload proof photo"}
      </Button>
    </div>
  );
}
