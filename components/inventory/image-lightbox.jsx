"use client";

import { useEffect, useState } from "react";
import {
  Image as ImageIcon,
  RotateCcw,
  RotateCw,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** Interactive freely zoomable/rotatable preview of a material's scanned label image. */
export function ImageLightbox({ url, onClose }) {
  const [zoomScale, setZoomScale] = useState(1);
  const [rotationDegree, setRotationDegree] = useState(0);

  // Every newly opened image starts at 100% / upright.
  useEffect(() => {
    setZoomScale(1);
    setRotationDegree(0);
  }, [url]);

  return (
    <Dialog open={!!url} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-3xl p-4 max-h-[92vh] overflow-hidden flex flex-col">
        <DialogHeader className="pb-2 border-b">
          <div className="flex items-center justify-between gap-2 pr-6">
            <DialogTitle className="flex items-center gap-2 text-sm">
              <ImageIcon className="h-4 w-4 text-primary" /> Reference Material Label Image
            </DialogTitle>
            <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-md">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                title="Zoom Out"
                onClick={() => setZoomScale((z) => Math.max(z - 0.25, 0.5))}
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </Button>
              <span className="text-xs font-mono font-medium px-1.5 text-muted-foreground w-12 text-center select-none">
                {Math.round(zoomScale * 100)}%
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                title="Zoom In"
                onClick={() => setZoomScale((z) => Math.min(z + 0.25, 4))}
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </Button>

              <div className="h-4 w-px bg-border mx-1" />

              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                title="Rotate Clockwise"
                onClick={() => setRotationDegree((r) => (r + 90) % 360)}
              >
                <RotateCw className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                title="Reset Zoom & Rotation"
                onClick={() => {
                  setZoomScale(1);
                  setRotationDegree(0);
                }}
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="relative border rounded-lg bg-black/95 flex-1 min-h-[350px] max-h-[75vh] overflow-auto flex items-center justify-center p-4">
          {url && (
            <img
              src={url}
              alt="Full Scanned Label"
              className="max-h-[70vh] w-auto max-w-full object-contain rounded transition-transform duration-200 ease-out select-none cursor-grab active:cursor-grabbing"
              style={{
                transform: `scale(${zoomScale}) rotate(${rotationDegree}deg)`,
              }}
            />
          )}
        </div>
        <DialogFooter className="pt-2">
          <div className="text-xs text-muted-foreground flex-1 flex items-center gap-2">
            <span>Use controls above to zoom (50% – 400%) or rotate the scanned label.</span>
          </div>
          <Button variant="outline" size="sm" onClick={onClose}>
            Close Preview
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
