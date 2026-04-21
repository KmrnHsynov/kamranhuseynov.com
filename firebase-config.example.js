'use strict';

// Copy this file to firebase-config.js and fill in your values.
// firebase-config.js is gitignored and must NEVER be committed.
// Get these values from: Firebase Console → Project Settings → Your Apps

const FIREBASE_CONFIG = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT.firebaseapp.com",
  databaseURL:       "https://YOUR_PROJECT-default-rtdb.firebaseio.com",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_PROJECT.firebasestorage.app",
  messagingSenderId: "YOUR_SENDER_ID",
  appId:             "YOUR_APP_ID"
};

firebase.initializeApp(FIREBASE_CONFIG);
const db = firebase.database();
