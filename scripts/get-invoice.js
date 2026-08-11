const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const serviceAccountPath = path.resolve(__dirname, '../service-account.json');
let credential;

if (fs.existsSync(serviceAccountPath)) {
  credential = admin.credential.cert(require(serviceAccountPath));
} else {
  credential = admin.credential.applicationDefault();
}

admin.initializeApp({
  credential,
  projectId: "explore-salon"
});

const db = admin.firestore();
db.collection('invoices').doc('EXP-260806-013').get()
  .then(doc => {
    if (doc.exists) {
      console.log(JSON.stringify(doc.data(), null, 2));
    } else {
      console.log("Invoice not found by ID. Querying by invoiceNumber...");
      db.collection('invoices').where('invoiceNumber', '==', 'EXP-260806-013').get()
        .then(snap => {
            if (snap.empty) {
                console.log("Still not found.");
            } else {
                console.log(JSON.stringify(snap.docs[0].data(), null, 2));
            }
            process.exit(0);
        });
    }
  })
  .catch(error => {
    console.error("Error:", error);
    process.exit(1);
  });
