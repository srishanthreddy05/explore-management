const fs = require('fs');
const path = require('path');
const { initializeApp } = require('firebase/app');
const {
  getFirestore,
  collection,
  getDocs,
  doc,
  writeBatch
} = require('firebase/firestore');

// Load environment variables from .env.local
const dotenvPath = path.resolve(__dirname, '../.env.local');
const env = {};
if (fs.existsSync(dotenvPath)) {
  const content = fs.readFileSync(dotenvPath, 'utf8');
  content.split('\n').forEach((line) => {
    const parts = line.split('=');
    if (parts.length >= 2) {
      env[parts[0].trim()] = parts.slice(1).join('=').trim();
    }
  });
}

const firebaseConfig = {
  apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

if (!firebaseConfig.projectId) {
  console.error("Error: Project ID not found in .env.local. Make sure you run this in the root workspace folder.");
  process.exit(1);
}

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

function getInvoiceDateKeys(invoice) {
  let dateKey = invoice.dateKey;
  if (!dateKey) {
    let d = new Date();
    if (invoice.date) {
      d = typeof invoice.date.toDate === 'function' ? invoice.date.toDate() : new Date(invoice.date);
    }
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    dateKey = `${yyyy}-${mm}-${dd}`;
  }
  return {
    dateKey,
    monthKey: dateKey.slice(0, 7),
  };
}

function getInvoicePayments(inv) {
  return {
    cash:
      inv.paymentSplit?.cash ??
      inv.payments?.cash ??
      (inv.paymentMethod === 'Cash' ? inv.grandTotal || 0 : 0),
    upi:
      inv.paymentSplit?.upi ??
      inv.payments?.upi ??
      (inv.paymentMethod === 'UPI' ? inv.grandTotal || 0 : 0),
    card:
      inv.paymentSplit?.card ??
      inv.payments?.card ??
      (inv.paymentMethod === 'Card' ? inv.grandTotal || 0 : 0),
  };
}

function getServiceCommission(s, inv) {
  const discountFactor = inv && inv.subtotal > 0 ? (inv.grandTotal / inv.subtotal) : 1;
  const serviceBaseAmount = s.amount ?? Math.max((s.price || 0) - (s.discount || 0), 0);
  const amount = serviceBaseAmount * discountFactor;
  const cost = s.usedProductCost || 0;
  
  let role = s.staffRole;
  if (!role) {
    if (s.serviceId === 'membership_fee' || s.staffId === 'system' || s.staffName === 'System') {
      role = 'Owner';
    } else {
      role = 'Stylist';
    }
  }

  let stylistShare = 0;
  let ownerShare = 0;

  if (role === 'Owner') {
    stylistShare = 0;
    ownerShare = amount;
  } else {
    stylistShare = 0.5 * amount - cost;
    ownerShare = 0.5 * amount + cost;
  }

  return {
    serviceRevenue: amount,
    productCost: cost,
    stylistShare,
    ownerShare,
  };
}

async function runMigration() {
  console.log("Starting backfill migration...");
  console.log("Using configuration for project:", firebaseConfig.projectId);

  try {
    // 1. Fetch all invoices
    const invoicesSnap = await getDocs(collection(db, 'invoices'));
    console.log(`Fetched ${invoicesSnap.size} invoices.`);

    const monthlyStats = {};
    const dailyStats = {};
    const staffStats = {};

    invoicesSnap.forEach((docSnap) => {
      const inv = docSnap.data();
      const { dateKey, monthKey } = getInvoiceDateKeys(inv);
      const payments = getInvoicePayments(inv);
      const grandTotal = inv.grandTotal || 0;

      // Initialize monthly stats
      if (!monthlyStats[monthKey]) {
        monthlyStats[monthKey] = { totalRevenue: 0, totalVisits: 0, cash: 0, upi: 0, card: 0 };
      }
      monthlyStats[monthKey].totalRevenue += grandTotal;
      monthlyStats[monthKey].totalVisits += 1;
      monthlyStats[monthKey].cash += payments.cash;
      monthlyStats[monthKey].upi += payments.upi;
      monthlyStats[monthKey].card += payments.card;

      // Initialize daily stats
      if (!dailyStats[dateKey]) {
        dailyStats[dateKey] = {
          totalRevenue: 0,
          totalVisits: 0,
          cash: 0,
          upi: 0,
          card: 0,
          serviceRevenue: 0,
          productCost: 0,
          stylistShare: 0,
          ownerShare: 0,
          retailProductsRevenue: 0
        };
      }
      dailyStats[dateKey].totalRevenue += grandTotal;
      dailyStats[dateKey].totalVisits += 1;
      dailyStats[dateKey].cash += payments.cash;
      dailyStats[dateKey].upi += payments.upi;
      dailyStats[dateKey].card += payments.card;

      (inv.services || []).forEach((s) => {
        const comm = getServiceCommission(s, inv);
        dailyStats[dateKey].serviceRevenue += comm.serviceRevenue;
        dailyStats[dateKey].productCost += comm.productCost;
        dailyStats[dateKey].stylistShare += comm.stylistShare;
        dailyStats[dateKey].ownerShare += comm.ownerShare;
      });

      // Add retail product sales to owner's share
      const discountFactor = inv.subtotal > 0 ? (inv.grandTotal / inv.subtotal) : 1;
      (inv.products || []).forEach((p) => {
        const productBaseAmount = p.amount ?? Math.max((p.price || 0) * (p.quantity || 1) - (p.discount || 0), 0);
        const amount = productBaseAmount * discountFactor;
        dailyStats[dateKey].ownerShare += amount;
      });

      // Staff monthly splits
      const staffInvoiceSummary = {};
      const discountFactor = inv && inv.subtotal > 0 ? (inv.grandTotal / inv.subtotal) : 1;
      (inv.services || []).forEach((s) => {
        const staffId = s.staffId || 'unassigned';
        if (!staffInvoiceSummary[staffId]) {
          staffInvoiceSummary[staffId] = { revenue: 0, servicesCount: 0, productCost: 0 };
        }
        const serviceBaseAmount = s.amount ?? Math.max((s.price || 0) - (s.discount || 0), 0);
        const amount = serviceBaseAmount * discountFactor;
        const cost = s.usedProductCost || 0;
        staffInvoiceSummary[staffId].revenue += amount;
        staffInvoiceSummary[staffId].servicesCount += 1;
        staffInvoiceSummary[staffId].productCost += cost;
      });

      Object.entries(staffInvoiceSummary).forEach(([staffId, summary]) => {
        const staffMonthKey = `${staffId}_${monthKey}`;
        if (!staffStats[staffMonthKey]) {
          staffStats[staffMonthKey] = { revenue: 0, servicesCount: 0, visits: 0, productCost: 0 };
        }
        staffStats[staffMonthKey].revenue += summary.revenue;
        staffStats[staffMonthKey].servicesCount += summary.servicesCount;
        staffStats[staffMonthKey].productCost += summary.productCost;
        staffStats[staffMonthKey].visits += 1; // 1 visit per invoice worked on
      });
    });

    console.log("Aggregation complete. Writing to stats collection in Firestore...");

    // 2. Write aggregated documents in batches of 500
    const ops = [];

    Object.entries(monthlyStats).forEach(([monthKey, stats]) => {
      ops.push({
        ref: doc(db, 'stats', `revenue_${monthKey}`),
        data: stats,
      });
    });

    Object.entries(dailyStats).forEach(([dateKey, stats]) => {
      ops.push({
        ref: doc(db, 'stats', `daily_${dateKey}`),
        data: stats,
      });
    });

    Object.entries(staffStats).forEach(([staffMonthKey, stats]) => {
      const [staffId, monthKey] = staffMonthKey.split('_');
      ops.push({
        ref: doc(db, 'stats', `staff_${staffId}_${monthKey}`),
        data: stats,
      });
    });

    console.log(`Writing ${ops.length} stats documents...`);

    let batch = writeBatch(db);
    let count = 0;

    for (const op of ops) {
      batch.set(op.ref, op.data, { merge: true });
      count++;
      if (count % 400 === 0) {
        await batch.commit();
        batch = writeBatch(db);
        console.log(`Committed ${count} writes...`);
      }
    }

    if (count % 400 !== 0) {
      await batch.commit();
    }

    console.log("Migration backfill completed successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
  }
}

runMigration();
