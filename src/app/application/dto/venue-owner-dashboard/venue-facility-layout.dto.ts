export type FacilityObjectType =
  | 'RECEPTION' | 'ENTRANCE' | 'PARKING' | 'LOCKER' | 'WC'
  | 'WAITING' | 'CAFE' | 'STORAGE' | 'CUSTOM';

export interface FacilityLayoutItem {
  id: string;
  type: 'COURT' | FacilityObjectType;
  courtId?: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zoneId?: string;
  icon?: string;
}

export interface FacilityZone {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface VenueFacilityLayout {
  version: 1;
  venueId: string;
  items: FacilityLayoutItem[];
  zones: FacilityZone[];
  updatedAt: string;
}

export type VenueFacilityLayoutUpdate = Pick<VenueFacilityLayout, 'items' | 'zones'>;
