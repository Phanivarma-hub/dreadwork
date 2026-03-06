import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: 'AIzaSyCZwd9ASxMJXGcmB81EfbM8mVMJmCoI-EQ',
    authDomain: 'dreadworrk.firebaseapp.com',
    projectId: 'dreadworrk',
    storageBucket: 'dreadworrk.firebasestorage.app',
    messagingSenderId: '644339421366',
    appId: '1:644339421366:android:c4a6c0b24f0f4af9ff9617',
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
