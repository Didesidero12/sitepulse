// lib/types.ts
export interface Ticket {
  id: string;
  shortId?: string;
  material: string;
  qty: string;
  projectName: string;
  projectAddress: string;
  siteCoords: { lat: number; lng: number };
  csiDivision?: string;
  loadingEquipment?: string;
  operatingHours?: string;
  siteStatus?: 'Open' | 'Closed' | 'Temporarily Closed' | 'Congested';
  projectContacts?: Array<{
    name: string;
    phone: string;
    role: string;
  }>;
  anticipatedTime?: string;
  status: 'unclaimed' | 'claimed-untracking' | 'claimed-tracking' | 'arrived';
  vehicleSize?: 'Van' | 'Box Truck' | 'Flatbed' | '18-Wheeler';
  driverProposedTime?: string;
  gcNotified30min?: boolean;
  gcNotified5min?: boolean;
  // add more later as needed
}