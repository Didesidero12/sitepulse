// lib/types.ts — FINAL LOCKED VERSION
import type { DirectionsResponse } from '@mapbox/mapbox-sdk/services/directions';
import type { Timestamp } from 'firebase/firestore';

export type MapboxRoute = DirectionsResponse['routes'][number];

export type TicketStatus =
  | 'unclaimed'
  | 'claimed-untracking'
  | 'claimed-tracking'
  | 'arrived';

export interface Ticket {
  id: string;
  shortId?: string;

  // Core delivery
  material: string;
  qty: string;
  projectId: string;
  projectName: string;
  projectAddress: string;
  siteCoords: { lat: number; lng: number };

  // Metadata
  csiDivision?: string;
  loadingEquipment?: string;
  operatingHours?: string;
  siteStatus?: 'Open' | 'Closed' | 'Temporarily Closed' | 'Congested';
  projectContacts?: Array<{
    name: string;
    phone: string;
    role: string;
  }>;

  // Scheduling & Claim Flow
  anticipatedTime?: string;        // e.g. "10:30 AM" — from Whiteboard
  agreedTime?: string;             // final locked time
  driverProposedTime?: string;     // if driver changed it

  // Status & Driver
  status: TicketStatus;
  driverId?: string | null;
  vehicleType?: 'Van' | 'Box Truck' | 'Flatbed' | '18-Wheeler' | null;

  // Timestamps
  createdAt?: Timestamp;
  claimedAt?: Timestamp;
  trackingStartedAt?: Timestamp;
  arrivedAt?: Timestamp;

  // Driver location (written every few seconds)
  driverLocation?: { lat: number; lng: number };

  // GC notifications (already used)
  gcNotified30min?: boolean;
  gcNotified5min?: boolean;
  gcAlert30minShown?: boolean;
  gcAlert5minShown?: boolean;
}
// ADD THIS TO THE BOTTOM OF lib/types.ts
export type ProjectStatus = 'open' | 'closed' | 'on-hold';

export interface ProjectContact {
  name: string;
  phone: string;
  role: string;
}

export interface Project {
  id: string;
  name: string;
  address: string;
  siteCoords: { lat: number; lng: number };
  operatingHours: string;
  status: ProjectStatus;
  createdAt: Timestamp;
  pin?: string;
  shortCode: string;                    // ← ADD THIS
  primaryContact: ProjectContact;
  secondaryContact?: ProjectContact;
  notes?: string;
}