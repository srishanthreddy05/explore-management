import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";
import type { Settings } from "@/types/settings";

const COLLECTION_NAME = "settings";
const DOCUMENT_ID = "salon-settings";

const defaultSettings: Settings = {
  salonName: "Explore Salon",
  businessType: "Salon",
  address: "123 Main Street, Suite A",
  gstNumber: "Not Registered",
  phoneNumber: "+91 98765 43210",
  logoUrl: "",
  whatsAppNumber: "+91 98765 43210",
};

export async function getSettings(): Promise<Settings> {
  try {
    const docRef = doc(db, COLLECTION_NAME, DOCUMENT_ID);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return {
        ...defaultSettings,
        ...docSnap.data(),
      } as Settings;
    }
    // Seed settings if not found
    await setDoc(docRef, defaultSettings);
    return defaultSettings;
  } catch (error) {
    console.error("Error getting settings from Firestore:", error);
    return defaultSettings;
  }
}

export async function updateSettings(data: Partial<Settings>): Promise<void> {
  try {
    const docRef = doc(db, COLLECTION_NAME, DOCUMENT_ID);
    await setDoc(docRef, data, { merge: true });
  } catch (error) {
    console.error("Error updating settings in Firestore:", error);
    throw error;
  }
}

export function subscribeSettings(onUpdate: (settings: Settings) => void): () => void {
  const docRef = doc(db, COLLECTION_NAME, DOCUMENT_ID);
  return onSnapshot(
    docRef,
    (docSnap) => {
      if (docSnap.exists()) {
        onUpdate({
          ...defaultSettings,
          ...docSnap.data(),
        } as Settings);
      } else {
        setDoc(docRef, defaultSettings).then(() => {
          onUpdate(defaultSettings);
        });
      }
    },
    (error) => {
      console.error("Error listening to settings changes:", error);
      onUpdate(defaultSettings);
    }
  );
}
