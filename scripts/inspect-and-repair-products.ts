/**
 * Data integrity audit & safe repair utility for Service Supplies / Products.
 *
 * Rules:
 * - Identifies products where costPerServing was incorrectly derived from remaining servings.
 * - Reconstructs originalServings if amount and costPerServing are known:
 *     originalServings = Math.round(amount / costPerServing)
 * - Identifies and flags ambiguous records without blindly modifying them.
 * - Can be run in dry-run mode (default) or commit mode.
 */

import { initializeApp, getApps } from "firebase/app";
import { getFirestore, collection, getDocs, doc, updateDoc } from "firebase/firestore";
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
const db = getFirestore(app);

export interface ProductAuditResult {
  id: string;
  name: string;
  status: "healthy" | "repaired" | "ambiguous" | "skipped";
  details: string;
  originalData: {
    amount?: number | null;
    originalServings?: number | null;
    noOfServings?: number | null;
    costPerServing?: number | null;
  };
  repairedData?: {
    originalServings?: number;
    costPerServing?: number;
  };
}

export function auditProductRecord(docId: string, data: any): ProductAuditResult {
  if (data.type !== "service") {
    return {
      id: docId,
      name: data.name || "Unnamed",
      status: "skipped",
      details: "Retail product (not service supply)",
      originalData: {
        amount: data.amount,
        originalServings: data.originalServings,
        noOfServings: data.noOfServings,
        costPerServing: data.costPerServing,
      },
    };
  }

  const amount = Number(data.amount) || 0;
  const originalServings = Number(data.originalServings) || 0;
  const remainingServings = Number(data.noOfServings) || 0;
  const costPerServing = Number(data.costPerServing) || 0;

  // Case 1: Healthy record with originalServings > 0
  if (originalServings > 0 && amount > 0) {
    const expectedUnitCost = Math.round((amount / originalServings) * 100) / 100;
    // Check if costPerServing was corrupted to amount / remainingServings
    if (
      remainingServings > 0 &&
      remainingServings !== originalServings &&
      Math.abs(costPerServing - Math.round((amount / remainingServings) * 100) / 100) < 0.01
    ) {
      return {
        id: docId,
        name: data.name,
        status: "repaired",
        details: `Corrupted unit cost detected: costPerServing was ₹${costPerServing} (amount ₹${amount} / remaining ${remainingServings}). Recomputed correctly with originalServings (${originalServings}) to ₹${expectedUnitCost}.`,
        originalData: { amount, originalServings, noOfServings: remainingServings, costPerServing },
        repairedData: { originalServings, costPerServing: expectedUnitCost },
      };
    }

    return {
      id: docId,
      name: data.name,
      status: "healthy",
      details: `Healthy: amount=₹${amount}, originalServings=${originalServings}, remaining=${remainingServings}, cost/serving=₹${costPerServing}`,
      originalData: { amount, originalServings, noOfServings: remainingServings, costPerServing },
    };
  }

  // Case 2: Missing originalServings, but amount and costPerServing exist
  if (originalServings <= 0 && amount > 0 && costPerServing > 0) {
    const recoveredOriginal = Math.round(amount / costPerServing);
    if (recoveredOriginal > 0) {
      return {
        id: docId,
        name: data.name,
        status: "repaired",
        details: `Recovered originalServings: amount ₹${amount} ÷ costPerServing ₹${costPerServing} = ${recoveredOriginal} servings.`,
        originalData: { amount, originalServings, noOfServings: remainingServings, costPerServing },
        repairedData: { originalServings: recoveredOriginal, costPerServing },
      };
    }
  }

  // Case 3: Missing originalServings and costPerServing, but remainingServings and amount exist
  if (originalServings <= 0 && amount > 0 && remainingServings > 0 && costPerServing <= 0) {
    return {
      id: docId,
      name: data.name,
      status: "ambiguous",
      details: `Ambiguous: amount ₹${amount} and remainingServings ${remainingServings} exist, but originalServings and costPerServing are unknown. Cannot assume zero servings were consumed. Manual review required.`,
      originalData: { amount, originalServings, noOfServings: remainingServings, costPerServing },
    };
  }

  return {
    id: docId,
    name: data.name || "Unknown",
    status: "ambiguous",
    details: "Incomplete purchase data. Manual review required.",
    originalData: { amount, originalServings, noOfServings: remainingServings, costPerServing },
  };
}

async function runAudit(commit: boolean = false) {
  console.log(`Starting Product Stock & Costing Audit (commit=${commit})...`);
  try {
    const snap = await getDocs(collection(db, "products"));
    console.log(`Auditing ${snap.size} product documents...`);

    const results: ProductAuditResult[] = [];
    snap.forEach((d) => {
      results.push(auditProductRecord(d.id, d.data()));
    });

    const healthy = results.filter((r) => r.status === "healthy");
    const repaired = results.filter((r) => r.status === "repaired");
    const ambiguous = results.filter((r) => r.status === "ambiguous");
    const skipped = results.filter((r) => r.status === "skipped");

    console.log(`\n=== AUDIT SUMMARY ===`);
    console.log(`Total Products:    ${results.length}`);
    console.log(`Healthy Products:  ${healthy.length}`);
    console.log(`Repaired Products: ${repaired.length}`);
    console.log(`Ambiguous Records: ${ambiguous.length}`);
    console.log(`Retail Products:   ${skipped.length}`);

    if (repaired.length > 0) {
      console.log(`\n--- RECORDS TO REPAIR ---`);
      for (const r of repaired) {
        console.log(`[${r.id}] "${r.name}": ${r.details}`);
        if (commit && r.repairedData) {
          await updateDoc(doc(db, "products", r.id), r.repairedData);
          console.log(`  -> Committed repair to Firestore!`);
        }
      }
    }

    if (ambiguous.length > 0) {
      console.log(`\n--- AMBIGUOUS RECORDS (REQUIRING REVIEW) ---`);
      for (const r of ambiguous) {
        console.log(`[${r.id}] "${r.name}": ${r.details}`);
      }
    }
  } catch (err) {
    console.error("Audit error:", err);
  }
}

if (require.main === module) {
  const commit = process.argv.includes("--commit");
  runAudit(commit).then(() => process.exit(0));
}
