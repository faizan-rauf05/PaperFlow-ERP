"use client";

import { OrderFormPage } from "@/components/orders/order-form-page";

export default function EditOrderProposalPage() {
  return <OrderFormPage mode="edit" role="SALES" listHref="/dashboard/sales" />;
}
