// lib/trackingService.ts
import { db } from '@/app/lib/firebase';
import { collection, addDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';

let activeWatchId: number | null = null;
let deliveryId: string | null = null;

export const startTracking = async (projectId: string, onLocation: (loc: { lat: number; lng: number }) => void) => {
  if (activeWatchId !== null) return; // Already running

  deliveryId = localStorage.getItem(`deliveryId_${projectId}`);

  activeWatchId = navigator.geolocation.watchPosition(
    async (pos) => {
      const newLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      onLocation(newLoc);

      if (!deliveryId) {
        const docRef = await addDoc(collection(db, "deliveries"), {
          projectId,
          material: "Doors from Italy",
          qty: "12 bifolds",
          needsForklift: true,
          driverLocation: newLoc,
          status: "en_route",
          timestamp: serverTimestamp(),
        });
        deliveryId = docRef.id;
        localStorage.setItem(`deliveryId_${projectId}`, deliveryId);
      } else {
        await updateDoc(doc(db, "deliveries", deliveryId), {
          driverLocation: newLoc,
          lastUpdate: serverTimestamp(),
        });
      }
    },
    (err) => console.error(err),
    { enableHighAccuracy: true }
  );
};

export const stopTracking = () => {
  if (activeWatchId !== null) {
    navigator.geolocation.clearWatch(activeWatchId);
    activeWatchId = null;
  }
  if (deliveryId) {
    updateDoc(doc(db, "deliveries", deliveryId), {
      status: "arrived",
      arrivedAt: serverTimestamp(),
    });
    localStorage.removeItem(`deliveryId_${deliveryId.split('_')[1]}`);
    deliveryId = null;
  }
};