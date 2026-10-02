"use client";

import { OrderFormPage } from "@/components/orders/order-form-page";

export default function NewOrderProposalPage() {
  return <OrderFormPage mode="create" role="SALES" listHref="/dashboard/sales" />;
}
