// presets-sync.mjs
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { 
    getFirestore, 
    doc, 
    setDoc, 
    onSnapshot, 
    enableIndexedDbPersistence 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyA94tVR-NSTjRu6ntoCP__g6x9fsW2axPA",
    authDomain: "cofee-admin.firebaseapp.com",
    projectId: "cofee-admin",
    storageBucket: "cofee-admin.firebasestorage.app",
    messagingSenderId: "672467184010",
    appId: "1:672467184010:web:f355b216f92da2021b0073",
    measurementId: "G-L65F87QE18"
};

const STORAGE_KEY = 'metronome_presets_v3';
const DEFAULT_PRESETS = [56, 80, 100, 120];

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// הפעלת מטמון אופליין מובנה של Firestore
enableIndexedDbPersistence(db).catch((err) => {
    console.warn("Offline persistence note:", err.code);
});

const presetDocRef = doc(db, "metronome", "shared_presets");

// קריאת תבניות מקומיות (עובד מיידית גם אופליין)
export function getLocalPresets() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [...DEFAULT_PRESETS];
    } catch {
        return [...DEFAULT_PRESETS];
    }
}

// שמירת תבניות מקומית + סנכרון לענן
export async function savePresets(presetsArray) {
    const cleanArray = [...new Set(presetsArray)].sort((a, b) => a - b);
    
    // 1. שמירה מיידית מקומית (אופליין)
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cleanArray));
    } catch (e) {
        console.error("Local storage error:", e);
    }

    // 2. דחיפה לענן (Firestore יסנכרן אוטומטית ברגע שיש חיבור לרשת)
    try {
        await setDoc(presetDocRef, { 
            presets: cleanArray, 
            updatedAt: Date.now() 
        });
    } catch (e) {
        console.warn("Saved locally; will sync to cloud when online:", e);
    }
    
    return cleanArray;
}

// האזנה בזמן אמת לשינויים מכל דפדפן או מכשיר
export function subscribeToPresets(onUpdateCallback) {
    onUpdateCallback(getLocalPresets());

    onSnapshot(presetDocRef, (docSnap) => {
        if (docSnap.exists() && Array.isArray(docSnap.data().presets)) {
            const cloudPresets = docSnap.data().presets;
            localStorage.setItem(STORAGE_KEY, JSON.stringify(cloudPresets));
            onUpdateCallback(cloudPresets);
        }
    }, (error) => {
        console.error("Firestore sync error (check Rules):", error);
    });
}