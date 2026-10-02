"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import api, { getApiErrorMessage } from "@/lib/api/client";

/**
 * Downscale a camera photo client-side before it's uploaded — phone photos
 * are often several MB, and the server resizes to 1568px for Claude anyway,
 * so sending the full original just wastes upload time. Uses createImageBitmap
 * with imageOrientation:"from-image" so EXIF rotation is respected (unlike
 * plain <img>+canvas, which can silently drop it in some browsers). Falls back
 * to the original file untouched if compression isn't supported or fails —
 * never blocks the scan over an optimization.
 */
async function compressImageForUpload(file, maxDimension = 1600, quality = 0.85) {
  try {
    if (typeof createImageBitmap !== "function") return file;
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!blob) return file;
    return new File([blob], file.name || "label.jpg", { type: "image/jpeg" });
  } catch (error) {
    console.warn("Client-side image compression skipped:", error);
    return file;
  }
}

const PROGRESS_STEPS = [
  [30, "Optimizing label image…"],
  [75, "Reading the label with AI…"],
  [100, "Extracting details…"],
];

/**
 * Captures/uploads a label photo and reads it with the AI scanner. Returns
 * the raw extraction and the photo via onExtracted({ extracted, imageDataUrl })
 * — mapping it onto a form is the caller's job.
 */
export function ScanLabelDialog({ open, onOpenChange, onExtracted }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setFile(null);
      setPreview("");
      setProgress(0);
    }
  }, [open]);

  async function handleFile(e) {
    const picked = e.target.files?.[0];
    if (!picked) return;
    const compressed = await compressImageForUpload(picked);
    setFile(compressed);
    const reader = new FileReader();
    reader.onload = (evt) => setPreview(evt.target.result);
    reader.readAsDataURL(compressed);
  }

  async function handleScan() {
    setScanning(true);
    setProgress(5);
    let current = 5;
    const timer = setInterval(() => {
      current = Math.min(94, current + (current < 30 ? 6 : current < 75 ? 4 : 1));
      setProgress(current);
    }, 100);
    try {
      const { data } = await api.post("/materials/scan-label", {
        imageBase64: preview,
        mimeType: file?.type || "image/jpeg",
      });
      setProgress(100);
      onExtracted({ extracted: data.extracted || {}, imageDataUrl: preview });
      onOpenChange(false);
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      clearInterval(timer);
      setScanning(false);
    }
  }

  const stepText = PROGRESS_STEPS.find(([max]) => progress < max)?.[1] || PROGRESS_STEPS.at(-1)[1];

  return (
    <Dialog open={open} onOpenChange={(next) => !scanning && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> Scan Label
          </DialogTitle>
          <DialogDescription>
            Take or upload a photo of the label (paper roll, glue, ink or rope). The form is filled in for you to check.
          </DialogDescription>
        </DialogHeader>

        <input type="file" accept="image/*" capture="environment" ref={fileInputRef} onChange={handleFile} className="hidden" />
        {preview ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border bg-muted/30 p-2">
            <img src={preview} alt="Label preview" className="max-h-56 rounded object-contain" />
            <Button type="button" variant="secondary" size="sm" className="border" onClick={() => fileInputRef.current?.click()} disabled={scanning}>
              Change photo
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex h-44 w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/5"
          >
            <Camera className="h-8 w-8 text-primary" />
            <span className="text-sm font-medium text-foreground">Take or upload a photo</span>
            <span className="text-xs">JPG, PNG or WEBP</span>
          </button>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={scanning}>
            Cancel
          </Button>
          <Button onClick={handleScan} disabled={scanning || !preview} className="relative min-w-48 overflow-hidden">
            {scanning ? (
              <>
                <span className="absolute inset-0 bg-primary-foreground/25 transition-all" style={{ width: `${progress}%` }} />
                <span className="relative flex items-center gap-2 text-xs">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {progress}% · {stepText}
                </span>
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" /> Read Label
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
