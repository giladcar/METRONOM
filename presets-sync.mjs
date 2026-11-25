// presets-sync.mjs
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { 
    getFirestore, 
    doc, 
    setDoc, 
    onSnapshot, 
    enableIndexedDbPersistence 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// הדבק כאן את פרטי הפרויקט שלך מ-Firebase Console
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

const STORAGE_KEY = 'metronome_presets_v3';
const DEFAULT_PRESETS = [56, 80, 100, 120];

let db = null;
let presetDocRef = null;
let isCloudConfigured = firebaseConfig.apiKey !== "YOUR_API_KEY";

// אתחול Firebase רק אם הוזנו מפתחות אמיתיים
if (isCloudConfigured) {
    try {
        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        // הפעלת שמירת מטמון אופליין מובנית של Firestore
        enableIndexedDbPersistence(db).catch(() => {});
        presetDocRef = doc(db, "metronome", "shared_presets");
    } catch (e) {
        console.warn("Firebase init failed, running in local-only mode:", e);
        isCloudConfigured = false;
    }
}

// קריאת תבניות מקומיות (עובד תמיד גם אופליין)
export function getLocalPresets() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [...DEFAULT_PRESETS];
    } catch {
        return [...DEFAULT_PRESETS];
    }
}

// שמירת תבניות מקומית + דחיפה לענן ברגע שיש אינטרנט
export async function savePresets(presetsArray) {
    const cleanArray = [...new Set(presetsArray)].sort((a, b) => a - b);
    
    // 1. שמירה מיידית מקומית (אופליין)
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cleanArray));
    } catch (e) {
        console.error("Local storage error:", e);
    }

    // 2. סנכרון לענן (אם מוגדר ומחובר - Firestore ימתין אוטומטית לחיבור אם כרגע אופליין)
    if (isCloudConfigured && presetDocRef) {
        try {
            await setDoc(presetDocRef, { 
                presets: cleanArray, 
                updatedAt: Date.now() 
            });
        } catch (e) {
            console.warn("Offline - will sync when back online:", e);
        }
    }
    return cleanArray;
}

// האזנה בזמן אמת לשינויים מדפדפנים או משתמשים אחרים
export function subscribeToPresets(onUpdateCallback) {
    // טעינה ראשונית מהזיכרון המקומי
    onUpdateCallback(getLocalPresets());

    // אם הענן מוגדר, האזן לעדכונים חיים מכל מכשיר/דפדפן
    if (isCloudConfigured && presetDocRef) {
        onSnapshot(presetDocRef, (docSnap) => {
            if (docSnap.exists() && Array.isArray(docSnap.data().presets)) {
                const cloudPresets = docSnap.data().presets;
                localStorage.setItem(STORAGE_KEY, JSON.stringify(cloudPresets));
                onUpdateCallback(cloudPresets);
            }
        });
    }
}