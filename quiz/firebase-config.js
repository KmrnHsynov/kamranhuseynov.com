'use strict';

const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyB_wsJu9BF5FBPkR9tMC0dT8pPPsvXgdxw",
  authDomain:        "quiz-az-73c96.firebaseapp.com",
  databaseURL:       "https://quiz-az-73c96-default-rtdb.europe-west1.firebasedatabase.app",
  projectId:         "quiz-az-73c96",
  storageBucket:     "quiz-az-73c96.firebasestorage.app",
  messagingSenderId: "443509521109",
  appId:             "1:443509521109:web:ae87178c415c0accb4805c"
};

firebase.initializeApp(FIREBASE_CONFIG);
const db = firebase.database();
