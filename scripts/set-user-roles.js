const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Load service account if it exists
const serviceAccountPath = path.resolve(__dirname, '../service-account.json');
let credential;

if (fs.existsSync(serviceAccountPath)) {
  credential = admin.credential.cert(require(serviceAccountPath));
  console.log("Using service account credentials from service-account.json");
} else {
  // Fallback to application default credentials
  credential = admin.credential.applicationDefault();
  console.log("Using default application credentials from environment");
}

admin.initializeApp({
  credential
});

const args = process.argv.slice(2);
if (args.length < 2) {
  console.log("Usage: node scripts/set-user-roles.js <uid> <role>");
  console.log("Example: node scripts/set-user-roles.js abc123xyz admin");
  process.exit(1);
}

const uid = args[0];
const role = args[1];

if (role !== 'admin' && role !== 'staff') {
  console.error("Error: Role must be either 'admin' or 'staff'");
  process.exit(1);
}

admin.auth().setCustomUserClaims(uid, { role })
  .then(() => {
    console.log(`Successfully set role '${role}' for user UID: ${uid}`);
    process.exit(0);
  })
  .catch((error) => {
    console.error("Error setting custom claims:", error);
    process.exit(1);
  });
