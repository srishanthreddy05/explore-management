"use client";

import { useEffect, useState } from "react";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";

function num(value: any): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export default function ReconcileIssues() {
  const [result, setResult] = useState<string>("");

  useEffect(() => {
    async function run() {
      const lines: string[] = [];
      const log = (...args: any[]) => lines.push(args.join(" "));

      try {
        log("=== ISSUE 1: UNCLASSIFIED ₹50 ===");
        const q = query(
          collection(db, "invoices"),
          where("dateKey", ">=", "2026-08-01"),
          where("dateKey", "<=", "2026-08-31")
        );
        const snap = await getDocs(q);

        snap.forEach((docSnap) => {
          const inv = docSnap.data() as any;
          
          const cash = num(inv?.paymentSplit?.cash ?? inv?.payments?.cash ?? (inv?.paymentMethod === "Cash" ? inv?.grandTotal : 0));
          const upi = num(inv?.paymentSplit?.upi ?? inv?.payments?.upi ?? (inv?.paymentMethod === "UPI" ? inv?.grandTotal : 0));
          const card = num(inv?.paymentSplit?.card ?? inv?.payments?.card ?? (inv?.paymentMethod === "Card" ? inv?.grandTotal : 0));
          const advance = num(inv?.advanceUsed);
          
          const collected = cash + upi + card + advance;
          
          const ratio = num(inv?.grandTotal) > 0 ? Math.min(1, Math.max(0, collected / num(inv.grandTotal))) : 1;

          let serviceRevenue = 0;
          (inv?.services || []).forEach((s: any) => {
            let amount = s.amount !== undefined && s.amount !== null ? num(s.amount) : Math.max(num(s.price) - num(s.discount), 0) * (num(inv.subtotal) > 0 ? num(inv.grandTotal)/num(inv.subtotal) : 1);
            serviceRevenue += amount * ratio;
          });

          let retailRevenue = 0;
          (inv?.products || []).forEach((p: any) => {
            let amount = p.amount !== undefined && p.amount !== null ? num(p.amount) : Math.max(num(p.price)*(num(p.quantity)||1) - num(p.discount), 0) * (num(inv.subtotal) > 0 ? num(inv.grandTotal)/num(inv.subtotal) : 1);
            retailRevenue += amount * ratio;
          });

          let membershipRevenue = 0;
          const explicitMem = inv?.membershipRevenue ?? inv?.membershipAmount ?? inv?.membershipFee;
          if (explicitMem !== undefined && explicitMem !== null) {
             membershipRevenue = num(explicitMem) * ratio;
          }

          const totalClassified = serviceRevenue + retailRevenue + membershipRevenue;
          const diff = collected - totalClassified;
          
          if (Math.abs(diff) > 0.01) {
            log(`\\nInvoice: ${inv.invoiceNumber || docSnap.id} (${inv.dateKey})`);
            log(`  Collected: ${collected.toFixed(2)}`);
            log(`  Service: ${serviceRevenue.toFixed(2)}`);
            log(`  Retail: ${retailRevenue.toFixed(2)}`);
            log(`  Membership: ${membershipRevenue.toFixed(2)}`);
            log(`  Total Classified: ${totalClassified.toFixed(2)}`);
            log(`  Difference: ${diff.toFixed(2)}`);
            log(`  Raw fields: grandTotal=${inv.grandTotal} cash=${cash} upi=${upi} card=${card} advance=${advance}`);
          }
        });

        log("\\n=== ISSUE 2: STAFF DISCREPANCY ₹150 ===");
        
        let invTotalStylist = 0;
        const staffMap: Record<string, number> = {};

        snap.forEach((docSnap) => {
          const inv = docSnap.data() as any;
          const ratio = num(inv?.grandTotal) > 0 ? Math.min(1, Math.max(0, (num(inv?.paymentSplit?.cash ?? inv?.payments?.cash ?? (inv?.paymentMethod === "Cash" ? inv?.grandTotal : 0)) + num(inv?.paymentSplit?.upi ?? inv?.payments?.upi ?? (inv?.paymentMethod === "UPI" ? inv?.grandTotal : 0)) + num(inv?.paymentSplit?.card ?? inv?.payments?.card ?? (inv?.paymentMethod === "Card" ? inv?.grandTotal : 0)) + num(inv?.advanceUsed)) / num(inv.grandTotal))) : 1;

          (inv?.services || []).forEach((s: any) => {
             // Invoice trace (correct)
             let role = s.staffRole;
             if (!role) {
                if (s.serviceId === "membership_fee" || s.staffId === "system" || s.staffName === "System") role = "Owner";
                else role = "Stylist";
             }
             
             let amount = s.amount !== undefined && s.amount !== null ? num(s.amount) : Math.max(num(s.price) - num(s.discount), 0) * (num(inv.subtotal) > 0 ? num(inv.grandTotal)/num(inv.subtotal) : 1);
             const cost = num(s.usedProductCost);
             
             let trueStylistShare = 0;
             if (role !== "Owner") {
                trueStylistShare = (0.5 * amount - cost) * ratio;
             }
             invTotalStylist += trueStylistShare;

             // monthlyStaffShares logic (from page.tsx line 1400)
             // uses getServiceCommission but without ratio!
             let monthlyAmount = amount;
             let monthlyShare = 0;
             if (role !== "Owner") {
                monthlyShare = 0.5 * monthlyAmount - cost;
             }
             
             const staffId = s.staffId || "unassigned";
             if (!staffMap[staffId]) staffMap[staffId] = 0;
             staffMap[staffId] += monthlyShare;
             
             if (Math.abs(trueStylistShare - monthlyShare) > 0.01) {
                log(`  [Staff Diff] ${inv.invoiceNumber} | ${s.staffName} (${staffId})`);
                log(`    True (ratio applied): ${trueStylistShare.toFixed(2)} (ratio=${ratio.toFixed(2)})`);
                log(`    Monthly logic (no ratio): ${monthlyShare.toFixed(2)}`);
                log(`    Difference: ${(monthlyShare - trueStylistShare).toFixed(2)}`);
             }
          });
        });

        let cardTotal = 0;
        log(`\\nStaff Aggregation (monthlyStaffShares):`);
        Object.keys(staffMap).forEach(id => {
           log(`  ${id}: ${staffMap[id].toFixed(2)}`);
           cardTotal += staffMap[id];
        });
        
        log(`\\nTotal Invoice-Derived Stylist Share (ratio applied): ${invTotalStylist.toFixed(2)}`);
        log(`Total Monthly Logic Share (gross): ${cardTotal.toFixed(2)}`);
        log(`Difference: ${(cardTotal - invTotalStylist).toFixed(2)}`);

      } catch (e: any) {
        log("ERROR:", e.message);
      }
      setResult(lines.join("\\n"));
    }
    run();
  }, []);

  return (
    <div style={{ background: "#111", color: "#0f0", padding: "2rem", fontFamily: "monospace", whiteSpace: "pre", fontSize: "12px", minHeight: "100vh" }} id="debug-output">
      {result || "Loading..."}
    </div>
  );
}
