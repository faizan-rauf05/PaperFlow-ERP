"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import api, { getApiErrorMessage } from "@/lib/api/client";
import { EDITABLE_ORDER_STATUSES } from "@/lib/validations/sales-order";
import { OrderForm } from "./order-form";

function Notice({ listHref, children }) {
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Button variant="secondary" size="sm" asChild className="border">
        <Link href={listHref}>
          <ArrowLeft className="h-4 w-4" /> Back to Orders
        </Link>
      </Button>
      <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        {children}
      </div>
    </div>
  );
}

/**
 * Route body for the order proposal create/edit pages on every dashboard
 * (Sales, Admin, Manager). With `mode="edit"` it loads the order from the
 * route's [id] and refuses orders that are already in production.
 */
export function OrderFormPage({ mode, role, listHref }) {
  const { id } = useParams();
  const isEdit = mode === "edit";
  const [order, setOrder] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isEdit) return;
    let cancelled = false;
    api
      .get(`/orders/${id}`)
      .then(({ data }) => !cancelled && setOrder(data.order))
      .catch((e) => !cancelled && setError(getApiErrorMessage(e, "Could not load this order.")));
    return () => {
      cancelled = true;
    };
  }, [isEdit, id]);

  if (!isEdit) return <OrderForm role={role} listHref={listHref} />;
  if (error) return <Notice listHref={listHref}>{error}</Notice>;
  if (!order) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }
  if (!EDITABLE_ORDER_STATUSES.includes(order.status)) {
    return (
      <Notice listHref={listHref}>
        Order {order.orderNo} is already in production and can no longer be edited.
      </Notice>
    );
  }
  return <OrderForm key={order.id} order={order} role={role} listHref={listHref} />;
}
