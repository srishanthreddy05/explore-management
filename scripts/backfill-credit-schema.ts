/**
 * Standalone script to backfill credit_balances documents missing modern schema fields
 * (remainingAmount, collectionStatus, creditAmount) by deriving them from legacy fields (amount, status).
 *
 * Rules:
 * - Runs in DRY-RUN mode by default (read-only).
 * - Applies updates to Firestore only when run with --apply.
 * - NEVER overwrites any field that already exists on a document.
 * - Prints every document id and the exact fields it would set.
 *
 * Usage:
 *   DRY-RUN (default): npx tsx scripts/backfill-credit-schema.ts
 *   APPLY UPDATES:    npx tsx scripts/backfill-credit-schema.ts --apply
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
  console.log(`===         CREDIT SCHEMA BACKFILL AUDIT & REPAIR SCRIPT       ===`);
  console.log(`================================================================`);
  console.log(`MODE: ${isApply ? "⚠️ APPLY (Will write to Firestore)" : "🛡️ DRY-RUN ONLY (Read-only simulation - NO CHANGES MADE)"}\n`);

  try {
    await signInAnonymously(auth);

    const creditSnap = await getDocs(collection(db, "credit_balances"));
    console.log(`Fetched ${creditSnap.size} total credit_balances documents.`);

    const candidates: Array<{
      id: string;
      customerName: string;
      invoiceNumber: string;
      currentData: Record<string, any>;
      fieldsToSet: Record<string, any>;
    }> = [];

    creditSnap.forEach((d) => {
      const data = d.data();
      const fieldsToSet: Record<string, any> = {};

      const hasCreditAmount = data.creditAmount !== undefined && data.creditAmount !== null;
      const hasRemainingAmount = data.remainingAmount !== undefined && data.remainingAmount !== null;
      const hasCollectionStatus = data.collectionStatus !== undefined && data.collectionStatus !== null && String(data.collectionStatus).trim() !== "";

      // 1. Derive creditAmount if missing
      let derivedCreditAmount = data.creditAmount;
      if (!hasCreditAmount) {
        derivedCreditAmount = Number(data.amount ?? 0);
        fieldsToSet.creditAmount = derivedCreditAmount;
      }

      // 2. Derive remainingAmount if missing
      let derivedRemainingAmount = data.remainingAmount;
      if (!hasRemainingAmount) {
        if (String(data.status).toLowerCase() === "settled") {
          derivedRemainingAmount = 0;
        } else {
          derivedRemainingAmount = Number(data.amount ?? 0);
        }
        fieldsToSet.remainingAmount = derivedRemainingAmount;
      }

      // 3. Derive collectionStatus if missing
      if (!hasCollectionStatus) {
        const rem = Number(derivedRemainingAmount ?? data.amount ?? 0);
        const statusLower = String(data.status || "").toLowerCase();
        const collected = Number(data.collectedAmount ?? 0);
        const totalCred = Number(derivedCreditAmount ?? data.amount ?? rem);

        if (rem <= 0 || statusLower === "settled") {
          fieldsToSet.collectionStatus = "settled";
        } else if (collected > 0 || (totalCred > rem && totalCred > 0)) {
          fieldsToSet.collectionStatus = "partial";
        } else {
          fieldsToSet.collectionStatus = "pending";
        }
      }

      if (Object.keys(fieldsToSet).length > 0) {
        candidates.push({
          id: d.id,
          customerName: data.customerName || "Customer",
          invoiceNumber: data.originalInvoiceNumber || data.invoiceNumber || "—",
          currentData: {
            amount: data.amount,
            status: data.status,
            creditAmount: data.creditAmount,
            remainingAmount: data.remainingAmount,
            collectionStatus: data.collectionStatus,
            collectedAmount: data.collectedAmount,
          },
          fieldsToSet,
        });
      }
    });

    console.log(`\nFound ${candidates.length} credit_balances document(s) missing modern schema fields:\n`);

    if (candidates.length === 0) {
      console.log(`✅ All ${creditSnap.size} documents already have remainingAmount, collectionStatus, and creditAmount present!`);
    } else {
      for (let i = 0; i < candidates.length; i++) {
        const item = candidates[i];
        console.log(`[${i + 1}/${candidates.length}] Doc ID: ${item.id}`);
        console.log(`     Customer: ${item.customerName} | Invoice: ${item.invoiceNumber}`);
        console.log(`     Existing legacy fields: ${JSON.stringify(item.currentData)}`);
        console.log(`     Fields to set (NO OVERWRITES): ${JSON.stringify(item.fieldsToSet)}`);

        if (isApply) {
          const docRef = doc(db, "credit_balances", item.id);
          await updateDoc(docRef, {
            ...item.fieldsToSet,
            updatedAt: new Date().toISOString(),
          });
          console.log(`     ✅ COMMITTED backfill for ${item.id}`);
        } else {
          console.log(`     [DRY-RUN]: Would write: ${JSON.stringify(item.fieldsToSet)}`);
        }
        console.log(``);
      }
    }

    console.log(`================================================================`);
    console.log(`===                       SUMMARY                            ===`);
    console.log(`================================================================`);
    console.log(`Total credit documents checked : ${creditSnap.size}`);
    console.log(`Documents needing backfill     : ${candidates.length}`);
    console.log(`Documents already complete     : ${creditSnap.size - candidates.length}`);
    console.log(`Script Mode                    : ${isApply ? "COMMITTED" : "DRY-RUN (NO CHANGES MADE)"}`);
    console.log(`================================================================\n`);
  } catch (error) {
    console.error("Script error:", error);
  }
}

main();
