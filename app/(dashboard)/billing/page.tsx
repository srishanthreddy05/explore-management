"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { BillingTerminal } from "@/components/billing/BillingTerminal";

function BillingTerminalWithQuery() {
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit") || undefined;
  return <BillingTerminal editInvoiceId={editId} />;
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