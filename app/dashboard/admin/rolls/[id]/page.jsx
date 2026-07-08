"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import api, { getApiErrorMessage } from "@/lib/api/client";
import { formatDate, formatDateTime } from "@/lib/utils";

const STATUS_COLORS = {
  AVAILABLE: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  IN_USE: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  FINISHED: "bg-muted text-muted-foreground",
  WASTED: "bg-destructive/15 text-destructive",
};

export default function RollDetailPage() {
  const { id } = useParams();
  const [roll, setRoll] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/rolls/${id}`);
      setRoll(data.roll);
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (!roll) {
    return <p className="text-muted-foreground">Roll not found</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/admin/rolls"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold font-mono">{roll.rollNo}</h1>
          <p className="text-muted-foreground">{roll.material?.name}</p>
        </div>
        <Badge className={`ml-auto ${STATUS_COLORS[roll.status] || ""}`}>{roll.status}</Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Roll details</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 text-sm">
            <div><p className="text-muted-foreground text-xs">Barcode</p><p className="font-mono">{roll.barcode}</p></div>
            <div><p className="text-muted-foreground text-xs">Supplier</p><p>{roll.supplier || "—"}</p></div>
            <div><p className="text-muted-foreground text-xs">Batch / lot</p><p>{roll.batchLot || "—"}</p></div>
            <div><p className="text-muted-foreground text-xs">GSM / Width</p><p>{roll.gsm || "—"} / {roll.widthMm ? `${roll.widthMm}mm` : "—"}</p></div>
            <div><p className="text-muted-foreground text-xs">Weight</p><p>{roll.weightKg} kg (remaining: {roll.remainingWeightKg} kg)</p></div>
            <div><p className="text-muted-foreground text-xs">Length</p><p>{roll.lengthM} m (remaining: {roll.remainingLengthM} m)</p></div>
            <div><p className="text-muted-foreground text-xs">Date received</p><p>{formatDate(roll.receivedAt)}</p></div>
            <div><p className="text-muted-foreground text-xs">Storage</p><p>{roll.storageLocation || "—"}</p></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>QR Code</CardTitle></CardHeader>
          <CardContent className="flex flex-col items-center gap-3">
            <QRCodeSVG value={roll.barcode} size={160} />
            <p className="font-mono text-sm text-muted-foreground">{roll.barcode}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Transaction history</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead>Remarks</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(roll.transactions || []).length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No transactions</TableCell></TableRow>
              ) : roll.transactions.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="text-sm">{formatDateTime(t.createdAt)}</TableCell>
                  <TableCell>{t.transactionType}</TableCell>
                  <TableCell className="text-right">{t.quantity} {t.unit}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{t.remarks || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
