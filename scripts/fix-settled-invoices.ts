/**
 * Standalone one-time script to identify and optionally fix invoices
 * whose credit_balances documents are all settled, but whose invoice records
 * still reflect a stale balanceDue > 0 or paymentStatus !== "paid".
 *
 * Usage:
 *   DRY-RUN (default): npx tsx scripts/fix-settled-invoices.ts
 *   APPLY UPDATES:    npx tsx scripts/fix-settled-invoices.ts --apply
 */

import { initializeApp, getApps } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  updateDoc,
} from "firebase/firestore";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);
const db = getFirestore(app);

async function main() {
  const isApply = process.argv.includes("--apply");
  console.log(`\n================================================================`);
  console.log(`===         FIX SETTLED INVOICES AUDIT & REPAIR SCRIPT       ===`);
  console.log(`================================================================`);
  console.log(`MODE: ${isApply ? "⚠️ APPLY (Will write to Firestore)" : "🛡️ DRY-RUN ONLY (Read-only simulation - NO CHANGES MADE)"}\n`);

  try {
    await signInAnonymously(auth);

    const [creditSnap, invoiceSnap] = await Promise.all([
      getDocs(collection(db, "credit_balances")),
      getDocs(collection(db, "invoices")),
    ]);

    console.log(`Fetched ${creditSnap.size} credit_balances documents`);
    console.log(`Fetched ${invoiceSnap.size} invoices documents`);

    // Group credit documents by invoiceId / originalInvoiceId / invoiceNumber
    const creditsByInvoiceId = new Map<string, any[]>();
    const creditsByInvoiceNum = new Map<string, any[]>();

    creditSnap.forEach((d) => {
      const data = { id: d.id, ...d.data() } as any;
      const invId = data.originalInvoiceId || data.invoiceId;
      const invNum = data.originalInvoiceNumber || data.invoiceNumber;

      if (invId) {
        if (!creditsByInvoiceId.has(invId)) creditsByInvoiceId.set(invId, []);
        creditsByInvoiceId.get(invId)!.push(data);
      }
      if (invNum) {
        if (!creditsByInvoiceNum.has(invNum)) creditsByInvoiceNum.set(invNum, []);
        creditsByInvoiceNum.get(invNum)!.push(data);
      }
    });

    const candidateInvoices: {
      invoiceId: string;
      invoiceNumber: string;
      customerName: string;
      paymentMethod: string;
      grandTotal: number;
      receivedAmount: number;
      currentBalanceDue: number;
      proposedBalanceDue: number;
      currentPaymentStatus: string;
      proposedPaymentStatus: string;
      creditDocs: any[];
      isSuspicious: boolean;
      suspiciousReason?: string;
    }[] = [];

    const suspiciousInvoices: typeof candidateInvoices = [];

    invoiceSnap.forEach((d) => {
      const inv = { id: d.id, ...d.data() } as any;
      const invId = inv.id;
      const invNum = inv.invoiceNumber || inv.invoiceNo;

      // Check if this invoice is linked to any credit documents
      const linkedCredits = [
        ...(creditsByInvoiceId.get(invId) || []),
        ...(invNum ? (creditsByInvoiceNum.get(invNum) || []) : []),
      ];

      // Remove duplicate credit document references by doc ID
      const uniqueCreditDocs = Array.from(
        new Map(linkedCredits.map((c) => [c.id, c])).values()
      );

      if (uniqueCreditDocs.length === 0) return; // Not a credit invoice

      // Check if there are any pending credit documents vs settled
      const pendingDocs = uniqueCreditDocs.filter((c) => {
        const remaining = Number(c.remainingAmount !== undefined ? c.remainingAmount : (c.amount ?? 0));
        const statusLower = String(c.status || "").toLowerCase();
        const colStatusLower = String(c.collectionStatus || "").toLowerCase();
        return remaining > 0 && statusLower !== "settled" && colStatusLower !== "settled";
      });

      const settledDocs = uniqueCreditDocs.filter((c) => {
        const remaining = Number(c.remainingAmount !== undefined ? c.remainingAmount : (c.amount ?? 0));
        const statusLower = String(c.status || "").toLowerCase();
        const colStatusLower = String(c.collectionStatus || "").toLowerCase();
        return remaining <= 0 || statusLower === "settled" || colStatusLower === "settled";
      });

      const balanceDue = Number(inv.balanceDue ?? 0);
      const paymentStatus = String(inv.paymentStatus || "").toLowerCase();
      const paymentMethod = inv.paymentMethod || "Unknown";

      // Suspicious check: Mixed pending and settled docs on the same invoice
      if (pendingDocs.length > 0 && settledDocs.length > 0) {
        suspiciousInvoices.push({
          invoiceId: invId,
          invoiceNumber: invNum || "—",
          customerName: inv.customerName || "Customer",
          paymentMethod,
          grandTotal: Number(inv.grandTotal ?? 0),
          receivedAmount: Number(inv.receivedAmount ?? 0),
          currentBalanceDue: balanceDue,
          proposedBalanceDue: balanceDue,
          currentPaymentStatus: inv.paymentStatus || "(none)",
          proposedPaymentStatus: inv.paymentStatus || "(none)",
          creditDocs: uniqueCreditDocs,
          isSuspicious: true,
          suspiciousReason: `Mixed status: has ${pendingDocs.length} pending doc(s) and ${settledDocs.length} settled doc(s). Remaining pending debt: ₹${pendingDocs.reduce((s, c) => s + Number(c.remainingAmount ?? c.amount ?? 0), 0)}`,
        });
      }

      // Suspicious check: Payment method is not Credit but has credit balance docs
      const isNotCreditPaymentMethod = paymentMethod.toLowerCase() !== "credit";

      // If ALL linked credit documents are settled:
      if (pendingDocs.length === 0 && settledDocs.length > 0) {
        if (balanceDue > 0 || paymentStatus !== "paid") {
          const item = {
            invoiceId: invId,
            invoiceNumber: invNum || "—",
            customerName: inv.customerName || "Customer",
            paymentMethod,
            grandTotal: Number(inv.grandTotal ?? 0),
            receivedAmount: Number(inv.receivedAmount ?? 0),
            currentBalanceDue: balanceDue,
            proposedBalanceDue: 0,
            currentPaymentStatus: inv.paymentStatus || "(none)",
            proposedPaymentStatus: "paid",
            creditDocs: settledDocs,
            isSuspicious: isNotCreditPaymentMethod,
            suspiciousReason: isNotCreditPaymentMethod
              ? `paymentMethod is "${paymentMethod}" (not "Credit")`
              : undefined,
          };

          candidateInvoices.push(item);
          if (isNotCreditPaymentMethod) {
            suspiciousInvoices.push(item);
          }
        }
      }
    });

    console.log(`\n================================================================`);
    console.log(`===   1. INVOICES TO FIX (ALL LINKED CREDIT DOCS ARE SETTLED)   ===`);
    console.log(`================================================================`);
    console.log(`Found ${candidateInvoices.length} invoices with stale balanceDue / paymentStatus:\n`);

    candidateInvoices.forEach((item, index) => {
      console.log(`[${index + 1}/${candidateInvoices.length}] Invoice Number: ${item.invoiceNumber}`);
      console.log(`     Firestore Doc ID : ${item.invoiceId}`);
      console.log(`     Customer Name    : ${item.customerName}`);
      console.log(`     Payment Method   : ${item.paymentMethod}`);
      console.log(`     Grand Total      : ₹${item.grandTotal}`);
      console.log(`     Received Amount  : ₹${item.receivedAmount}`);
      console.log(`     balanceDue       : ₹${item.currentBalanceDue}  -->  PROPOSED: ₹${item.proposedBalanceDue}`);
      console.log(`     paymentStatus    : "${item.currentPaymentStatus}"  -->  PROPOSED: "${item.proposedPaymentStatus}"`);
      console.log(`     Linked Credit Docs (${item.creditDocs.length}):`);
      item.creditDocs.forEach((c) => {
        console.log(`       - Doc ID: ${c.id} | Amount: ₹${c.creditAmount ?? c.amount} | Remaining: ₹${c.remainingAmount ?? 0} | Status: "${c.status}" | CollectionStatus: "${c.collectionStatus}"`);
      });
      if (item.isSuspicious) {
        console.log(`     ⚠️  FLAGGED: ${item.suspiciousReason}`);
      }
      console.log(``);

      if (isApply) {
        const invRef = doc(db, "invoices", item.invoiceId);
        updateDoc(invRef, {
          balanceDue: 0,
          paymentStatus: "paid",
          updatedAt: new Date().toISOString(),
        }).then(() => {
          console.log(`     ✅ COMMITTED UPDATE for ${item.invoiceNumber}`);
        });
      }
    });

    console.log(`================================================================`);
    console.log(`===                 2. SUSPICIOUS CHECKS                     ===`);
    console.log(`================================================================`);
    if (suspiciousInvoices.length === 0) {
      console.log(`✅ No suspicious invoices found! All invoices cleanly categorized.`);
    } else {
      console.log(`Found ${suspiciousInvoices.length} item(s) flagged for review:\n`);
      suspiciousInvoices.forEach((s, idx) => {
        console.log(`[Flag ${idx + 1}] Invoice: ${s.invoiceNumber} (${s.invoiceId})`);
        console.log(`       Reason: ${s.suspiciousReason}`);
        console.log(`       Payment Method: ${s.paymentMethod}`);
        console.log(`       balanceDue: ₹${s.currentBalanceDue} | paymentStatus: "${s.currentPaymentStatus}"`);
        console.log(``);
      });
    }

    console.log(`================================================================`);
    console.log(`===                       SUMMARY                            ===`);
    console.log(`================================================================`);
    console.log(`Total invoices checked            : ${invoiceSnap.size}`);
    console.log(`Total credit documents checked    : ${creditSnap.size}`);
    console.log(`Stale invoices proposed for update: ${candidateInvoices.length}`);
    console.log(`Suspicious items flagged          : ${suspiciousInvoices.length}`);
    console.log(`Script Mode                       : ${isApply ? "COMMITTED" : "DRY-RUN (NO CHANGES MADE)"}`);
    console.log(`================================================================\n`);
  } catch (error) {
    console.error("Script error:", error);
  }
}

main();
