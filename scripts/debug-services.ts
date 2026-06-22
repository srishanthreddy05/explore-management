import * as fs from 'fs';
import * as path from 'path';
import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  getDocs
} from 'firebase/firestore';

const dotenvPath = path.resolve(__dirname, '../.env.local');
const env: Record<string, string> = {};
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
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function debugServices() {
  try {
    console.log("Checking all service documents in Firestore...");
    const snap = await getDocs(collection(db, "services"));
    console.log(`Total services in DB: ${snap.size}`);
    snap.forEach(d => {
      const data = d.data();
      console.log(`- Service: "${data.name}", Category: "${data.category}", isActive: ${data.isActive}`);
    });

    console.log("\nChecking all category documents in Firestore...");
    const catSnap = await getDocs(collection(db, "serviceCategories"));
    console.log(`Total categories in DB: ${catSnap.size}`);
    catSnap.forEach(d => {
      const data = d.data();
      console.log(`- Category Doc ID: "${d.id}", Name: "${data.name}"`);
    });
  } catch (error) {
    console.error(error);
  }
}

debugServices();
