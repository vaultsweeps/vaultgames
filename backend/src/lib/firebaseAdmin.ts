import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import * as path from 'path';

// Load service account from file
let serviceAccount: any;
try {
  serviceAccount = require('../../firebaseServiceAccount.json');
} catch (error) {
  console.warn('Firebase Service Account JSON not found at backend/firebaseServiceAccount.json. Firebase features will not work.');
}

let app;
if (serviceAccount && !getApps().length) {
  app = initializeApp({
    credential: cert(serviceAccount)
  });
}

const auth = getAuth(app);

export { auth };

