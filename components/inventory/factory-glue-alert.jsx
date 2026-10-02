"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import api from "@/lib/api/client";

/**
 * Dashboard alert: glue types below their drum minimum in the factory.
 * Renders nothing while loading, on error, or when every type is fine.
 * `tasksHref` links to where the supply task is handled (warehouse only).
 */
export function FactoryGlueAlert({ tasksHref }) {
  const [low, setLow] = useState([]);

  useEffect(() => {
    let cancelled = false;
    api
      .get("/inventory/factory-glue")
      .then(({ data }) => {
        if (!cancelled) setLow((data.levels || []).filter((l) => l.isLow));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (low.length === 0) return null;

  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 shrink-0 text-destructive mt-0.5" />
        <div className="space-y-0.5">
          <p className="text-sm font-semibold text-destructive">Glue low in the factory</p>
          {low.map((l) => (
            <p key={l.glueType} className="text-sm text-foreground">
              {l.label}: {l.drums} drum{l.drums === 1 ? "" : "s"} (min {l.minDrums})
              <span className="text-muted-foreground">
                {" "}
                · supply {l.drumsNeeded} drum{l.drumsNeeded === 1 ? "" : "s"} of {l.drumKg} kg
              </span>
            </p>
          ))}
          {!tasksHref && <p className="text-xs text-muted-foreground">The warehouse has a supply task for this.</p>}
        </div>
      </div>
      {tasksHref && (
        <Button asChild size="sm" variant="outline" className="shrink-0">
          <Link href={tasksHref}>Open supply task</Link>
        </Button>
      )}
    </div>
  );
}
