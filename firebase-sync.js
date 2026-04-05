// firebase-sync.js
let firebaseReady = false;
let db = null;
let currentUser = null;

const firebaseConfig = {
    apiKey: "AIzaSyARKWwV3cggOhda9g6cDNcEAGOpUN4O63I",
    authDomain: "lifedashbord.firebaseapp.com",
    projectId: "lifedashbord",
    storageBucket: "lifedashbord.appspot.com",
    messagingSenderId: "206574362724",
    appId: "1:206574362724:web:83887cae4dc87b41137f71"
};

async function initFirebaseSync() {
    return new Promise((resolve) => {
        try {
            if (typeof firebase === 'undefined') {
                console.log('⚠️ Firebase not loaded');
                resolve(false);
                return;
            }
            
            if (!firebase.apps.length) {
                firebase.initializeApp(firebaseConfig);
            }
            
            db = firebase.firestore();
            var auth = firebase.auth();
            
            auth.onAuthStateChanged(function(user) {
                if (user) {
                    currentUser = user;
                    firebaseReady = true;
                    console.log('✅ Firebase connected:', user.email);
                    resolve(true);
                } else {
                    firebaseReady = false;
                    console.log('🔓 Not logged in');
                    resolve(false);
                }
            });
        } catch (e) {
            console.error('❌ Firebase init error:', e);
            firebaseReady = false;
            resolve(false);
        }
    });
}

async function saveData(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
    console.log('💾 Saved to localStorage:', key);
    
    if (firebaseReady && currentUser && db) {
        try {
            await db.collection('users').doc(currentUser.uid).collection('data').doc(key).set({
                data: data,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            console.log('☁️ Synced to Firebase:', key);
        } catch (e) {
            console.error('❌ Firebase save failed:', e);
        }
    }
}

async function loadData(key, defaultValue = {}) {
    if (firebaseReady && currentUser && db) {
        try {
            const doc = await db.collection('users').doc(currentUser.uid).collection('data').doc(key).get();
            if (doc.exists) {
                const data = doc.data().data;
                localStorage.setItem(key, JSON.stringify(data));
                console.log('☁️ Loaded from Firebase:', key);
                return data;
            }
        } catch (e) {
            console.error('❌ Firebase load failed:', e);
        }
    }
    
    const local = localStorage.getItem(key);
    if (local) {
        console.log('💾 Loaded from localStorage:', key);
        return JSON.parse(local);
    }
    
    console.log('🆕 New data:', key);
    return defaultValue;
}

function getSyncStatus() {
    return {
        firebaseReady: firebaseReady,
        currentUser: currentUser?.email || null,
        isOnline: navigator.onLine
    };
}