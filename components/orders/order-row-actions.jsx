"use client";

import { useState } from "react";
import { MoreVertical, Archive, ArchiveRestore, Ban, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import api, { getApiErrorMessage } from "@/lib/api/client";

/**
 * Per-order row menu: Archive/Unarchive (pure visibility, reversible) and
 * Cancel (marks CANCELLED without deleting anything — pulls any open stages
 * out of the worker pool immediately).
 */
export function OrderRowActions({ order, onUpdated }) {
  const [busy, setBusy] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  const canCancel = !["COMPLETED", "CANCELLED"].includes(order.status);

  async function toggleArchive(e) {
    e.stopPropagation();
    setBusy(true);
    try {
      const { data } = await api.post(`/orders/${order.id}/archive`, {
        archived: !order.isArchived,
      });
      onUpdated(data.order);
      toast.success(order.isArchived ? "Order unarchived" : "Order archived");
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function submitCancel() {
    if (!cancelReason.trim()) {
      toast.error("Enter a reason for cancelling this order");
      return;
    }
    setCancelling(true);
    try {
      const { data } = await api.post(`/orders/${order.id}/cancel`, {
        reason: cancelReason.trim(),
      });
      onUpdated(data.order);
      toast.success("Order cancelled");
      setCancelOpen(false);
      setCancelReason("");
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setCancelling(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            disabled={busy}
            onClick={(e) => e.stopPropagation()}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreVertical className="h-4 w-4" />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuItem onClick={toggleArchive}>
            {order.isArchived ? (
              <>
                <ArchiveRestore className="h-4 w-4 mr-2" /> Unarchive
              </>
            ) : (
              <>
                <Archive className="h-4 w-4 mr-2" /> Archive
              </>
            )}
          </DropdownMenuItem>
          {canCancel && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  setCancelOpen(true);
                }}
              >
                <Ban className="h-4 w-4 mr-2" /> Cancel Order
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent onClick={(e) => e.stopPropagation()} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel Order {order.orderNo}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <p className="text-sm text-muted-foreground">
              This marks the order cancelled without deleting it — nothing already recorded is lost, and it drops off the worker pool immediately.
            </p>
            <Textarea
              placeholder="Reason for cancelling *"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>
              Back
            </Button>
            <Button variant="destructive" disabled={cancelling} onClick={submitCancel}>
              {cancelling && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirm Cancellation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
