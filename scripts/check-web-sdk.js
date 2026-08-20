import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, limit, query, orderBy } from "firebase/firestore";
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

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkInvoices() {
  const q = query(collection(db, "invoices"), orderBy("date", "asc"), limit(100));
  const snapshot = await getDocs(q);
  console.log(`Found ${snapshot.size} oldest invoices`);
  
  let withCost = 0;
  let withoutCost = 0;
  let totalServices = 0;
  let hasUsedProductId = 0;

  snapshot.forEach(doc => {
    const data = doc.data();
    if (data.services && Array.isArray(data.services)) {
      data.services.forEach(s => {
        totalServices++;
        if (s.usedProductCost !== undefined && s.usedProductCost !== null) {
          withCost++;
        } else {
          withoutCost++;
        }
        if (s.usedProductId) {
          hasUsedProductId++;
        }
      });
    }
  });
  
  console.log(`Total services checked: ${totalServices}`);
  console.log(`Services with usedProductCost: ${withCost}`);
  console.log(`Services without usedProductCost: ${withoutCost}`);
  console.log(`Services with usedProductId: ${hasUsedProductId}`);

  // Also let's check recent ones
  const qRecent = query(collection(db, "invoices"), orderBy("date", "desc"), limit(100));
  const snapshotRecent = await getDocs(qRecent);
  console.log(`\\nFound ${snapshotRecent.size} most recent invoices`);
  
  let withCostRecent = 0;
  let withoutCostRecent = 0;
  let totalServicesRecent = 0;
  let hasUsedProductIdRecent = 0;

  snapshotRecent.forEach(doc => {
    const data = doc.data();
    if (data.services && Array.isArray(data.services)) {
      data.services.forEach(s => {
        totalServicesRecent++;
        if (s.usedProductCost !== undefined && s.usedProductCost !== null) {
          withCostRecent++;
        } else {
          withoutCostRecent++;
        }
        if (s.usedProductId) {
          hasUsedProductIdRecent++;
        }
      });
    }
  });
  
  console.log(`Total recent services checked: ${totalServicesRecent}`);
  console.log(`Recent Services with usedProductCost: ${withCostRecent}`);
  console.log(`Recent Services without usedProductCost: ${withoutCostRecent}`);
  console.log(`Recent Services with usedProductId: ${hasUsedProductIdRecent}`);
}

checkInvoices().then(() => process.exit(0)).catch(console.error);
