"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function RollDetailRemovedPage() {
  return (
    <div className="space-y-4 py-8">
      <h1 className="text-2xl font-bold">Rolls removed</h1>
      <Button asChild variant="outline"><Link href="/dashboard/admin/materials">Go to Materials</Link></Button>
    </div>
  );
}
