const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

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
