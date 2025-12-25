import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Your web app's Firebase configuration
export const firebaseConfig = {
  apiKey: "AIzaSyC8Q6CqzYB3JmreYeo15WWsQqEtGXUu4UI",
  authDomain: "phenom-ear-trainer.firebaseapp.com",
  projectId: "phenom-ear-trainer",
  storageBucket: "phenom-ear-trainer.firebasestorage.app",
  messagingSenderId: "836367746282",
  appId: "1:836367746282:web:e7d9fc70f0b9e67fcd8393"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);