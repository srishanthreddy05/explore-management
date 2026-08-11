"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { BillingTerminal } from "@/components/billing/BillingTerminal";

function BillingTerminalWithQuery() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const editId = searchParams.get("edit") || undefined;
  const returnTo = searchParams.get("returnTo") || undefined;

  const handleClose = () => {
    if (returnTo) {
      router.push(returnTo);
    } else if (editId) {
      router.push("/invoices");
    }
  };

  return <BillingTerminal editInvoiceId={editId} onClose={handleClose} onSuccess={handleClose} />;
}

export default function BillingPage() {
  return (
    <Suspense fallback={
      <div className="flex h-[40vh] items-center justify-center">
        <div className="size-10 animate-spin rounded-full border-4 border-[#B8962E] border-t-transparent" />
      </div>
    }>
      <BillingTerminalWithQuery />
    </Suspense>
  );
}