const admin = require('firebase-admin');
import * as path from 'path';

// Load service account from file
let serviceAccount: any;
try {
  serviceAccount = require('../../firebaseServiceAccount.json');
} catch (error) {
  console.warn('Firebase Service Account JSON not found at backend/firebaseServiceAccount.json. Firebase features will not work.');
}

if (serviceAccount && !admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const auth = admin.auth();

export { auth };

