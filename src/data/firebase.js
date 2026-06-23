import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDI_LwNn6gigNZDPPzeEj7EOzTtvVD71qY",
  authDomain: "arc-trials-coordinator.firebaseapp.com",
  projectId: "arc-trials-coordinator",
  storageBucket: "arc-trials-coordinator.firebasestorage.app",
  messagingSenderId: "628368323980",
  appId: "1:628368323980:web:8a231834d31bb97efdd2a9",
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
