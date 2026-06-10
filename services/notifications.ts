import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  addDoc,
  getDocs,
  updateDoc,
  query,
  orderBy,
  where,
} from "firebase/firestore";
import type { Notification } from "@/types/notification";

const COLLECTION_NAME = "notifications";

export async function create(
  notification: Omit<Notification, "id">
): Promise<string> {
  try {
    const docRef = await addDoc(collection(db, COLLECTION_NAME), {
      ...notification,
      createdAt: notification.createdAt || new Date().toISOString(),
    });
    return docRef.id;
  } catch (error) {
    console.error("Error creating notification:", error);
    throw error;
  }
}

export async function getAll(): Promise<Notification[]> {
  try {
    const q = query(collection(db, COLLECTION_NAME), orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);
    const notifications: Notification[] = [];
    querySnapshot.forEach((doc) => {
      notifications.push({
        id: doc.id,
        ...doc.data(),
      } as Notification);
    });
    return notifications;
  } catch (error) {
    console.error("Error getting all notifications:", error);
    throw error;
  }
}

export async function markAsRead(id: string): Promise<void> {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, { read: true });
  } catch (error) {
    console.error(`Error marking notification (${id}) as read:`, error);
    throw error;
  }
}

export async function getUnreadCount(): Promise<number> {
  try {
    const q = query(collection(db, COLLECTION_NAME), where("read", "==", false));
    const querySnapshot = await getDocs(q);
    return querySnapshot.size;
  } catch (error) {
    console.error("Error getting unread notifications count:", error);
    return 0;
  }
}
export async function deleteNotification(id: string): Promise<void> {
  try {
    const { deleteDoc } = await import("firebase/firestore");
    const docRef = doc(db, COLLECTION_NAME, id);
    await deleteDoc(docRef);
  } catch (error) {
    console.error(`Error deleting notification (${id}):`, error);
    throw error;
  }
}
export { deleteNotification as delete };
