// client/src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth"; // 1. Added GoogleAuthProvider here
import { getAnalytics } from "firebase/analytics";
import { getStorage } from "firebase/storage"; 

const firebaseConfig = {
  apiKey: "AIzaSyA4jbp9YpJPZZmcFhL7Pm75-TOzlNE_V8w",
  authDomain: "unitime-db5fa.firebaseapp.com",
  projectId: "unitime-db5fa",
  storageBucket: "unitime-db5fa.firebasestorage.app",
  messagingSenderId: "806375496068",
  appId: "1:806375496068:web:771e800ba5d61d864ba5d1",
  measurementId: "G-4FWL8BHPR8"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Services
export const googleProvider = new GoogleAuthProvider();
// Permissions to view classes (roster for teachers, enrollment for students)
googleProvider.addScope('https://www.googleapis.com/auth/classroom.courses.readonly');
googleProvider.addScope('https://www.googleapis.com/auth/classroom.rosters.readonly');

export const db = getFirestore(app);
export const auth = getAuth(app);
export const analytics = getAnalytics(app);
export const storage = getStorage(app);

// 2. Initialize and Export Google Provider (Fixes the error)