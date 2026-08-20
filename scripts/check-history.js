const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
require('dotenv').config({ path: '.env.local' });

// Initialize Firebase Admin (assuming default credentials or process.env variables)
// if you have a service account key, you might need to require it and use cert()
const app = initializeApp();
const db = getFirestore(app);

async function checkInvoices() {
  const snapshot = await db.collection('invoices').limit(50).get();
  console.log(`Found ${snapshot.size} invoices`);
  
  let withCost = 0;
  let withoutCost = 0;

  snapshot.forEach(doc => {
    const data = doc.data();
    let hasCostInDoc = false;
    if (data.services && Array.isArray(data.services)) {
      data.services.forEach(s => {
        if (s.usedProductCost !== undefined) {
          hasCostInDoc = true;
        }
      });
    }
    
    if (hasCostInDoc) {
        withCost++;
    } else {
        withoutCost++;
    }
    
    if (withCost < 5 && hasCostInDoc) {
        console.log(`Invoice ${doc.id} has usedProductCost. Date: ${data.dateKey}`);
        console.log(data.services.map(s => ({
            name: s.serviceName,
            price: s.price,
            cost: s.usedProductCost
        })));
    }
    
    if (withoutCost < 5 && !hasCostInDoc && data.services?.length > 0) {
        console.log(`Invoice ${doc.id} DOES NOT have usedProductCost. Date: ${data.dateKey}`);
        console.log(data.services.map(s => ({
            name: s.serviceName,
            price: s.price,
            cost: s.usedProductCost
        })));
    }
  });
  
  console.log(`Total checked: ${snapshot.size}`);
  console.log(`Invoices with usedProductCost in at least one service: ${withCost}`);
  console.log(`Invoices without usedProductCost: ${withoutCost}`);
}

checkInvoices().catch(console.error);
