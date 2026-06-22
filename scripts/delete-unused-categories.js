const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const serviceAccountPath = path.resolve(__dirname, '../service-account.json');
let credential;

if (fs.existsSync(serviceAccountPath)) {
  credential = admin.credential.cert(require(serviceAccountPath));
  console.log("Using service account credentials from service-account.json");
} else {
  credential = admin.credential.applicationDefault();
  console.log("Using default application credentials from environment");
}

// Load environment variables from .env.local for project ID
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

admin.initializeApp({
  credential,
  projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
});

const db = admin.firestore();

async function cleanUnusedCategories() {
  console.log("Starting cleanup of unused categories...");
  try {
    // 1. Get all active services
    const servicesSnap = await db.collection("services").where("isActive", "==", true).get();
    const activeCategories = new Set();
    servicesSnap.forEach(doc => {
      const data = doc.data();
      if (data.category) {
        activeCategories.add(data.category.trim().toLowerCase());
      }
    });
    console.log(`Active categories in services:`, Array.from(activeCategories));

    // 2. Get all categories in serviceCategories
    const categoriesSnap = await db.collection("serviceCategories").get();
    let deleteCount = 0;
    
    for (const doc of categoriesSnap.docs) {
      const data = doc.data();
      const catName = data.name;
      if (catName && !activeCategories.has(catName.trim().toLowerCase())) {
        console.log(`Deleting unused category: "${catName}" (ID: ${doc.id})`);
        await db.collection("serviceCategories").doc(doc.id).delete();
        deleteCount++;
      }
    }
    
    console.log(`Cleanup complete! Deleted ${deleteCount} unused categories.`);
  } catch (error) {
    console.error("Cleanup failed:", error);
  }
}

cleanUnusedCategories();
