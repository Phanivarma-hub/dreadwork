import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence, getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const firebaseConfig = {
    apiKey: 'AIzaSyCZwd9ASxMJXGcmB81EfbM8mVMJmCoI-EQ',
    authDomain: 'dreadworrk.firebaseapp.com',
    projectId: 'dreadworrk',
    storageBucket: 'dreadworrk.firebasestorage.app',
    messagingSenderId: '644339421366',
    appId: '1:644339421366:android:c4a6c0b24f0f4af9ff9617',
};

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

let auth;
if (Platform.OS === 'web') {
    auth = getAuth(app);
} else {
    // For React Native, initialize with persistence if not already initialized
    try {
        auth = initializeAuth(app, {
            persistence: getReactNativePersistence(AsyncStorage)
        });
    } catch (error) {
        // If already initialized, just get the instance
        auth = getAuth(app);
    }
}

const db = getFirestore(app);

export { auth, db };
export default app;
