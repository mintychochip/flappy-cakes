import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBhGKeyV7J9y_7LxWPZQn2OuVxqUh3dJJk",
  authDomain: "flappy-cakes.firebaseapp.com",
  projectId: "flappy-cakes",
  storageBucket: "flappy-cakes.firebasestorage.app",
  messagingSenderId: "839616896872",
  appId: "1:839616896872:web:abc123def456" // This can be any valid format
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
