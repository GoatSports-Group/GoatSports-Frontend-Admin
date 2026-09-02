import { OwnerVenueCourt } from '@application/dto/venue-owner-dashboard/venue-owner-dashboard.dto';

export const FACILITY_CANVAS_WIDTH = 1000;
export const FACILITY_CANVAS_HEIGHT = 700;
export const FACILITY_GRID_SIZE = 20;

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

export interface LayoutLibraryItem {
  type: FacilityObjectType;
  label: string;
  icon: string;
}

export function createAutomaticFacilityLayout(
  venueId: string,
  courts: OwnerVenueCourt[]
): VenueFacilityLayout {
  const primaryCourtCount = Math.min(courts.length, 6);
  const columns = primaryCourtCount <= 2 ? 2 : 3;
  const courtWidth = columns === 2 ? 245 : 160;
  const courtHeight = 145;
  const courtGapX = columns === 2 ? 32 : 25;
  const courtStartX = columns === 2 ? 190 : 165;
  const courtStartY = 80;

  const courtItems = courts.map((court, index): FacilityLayoutItem => {
    if (index < 6) {
      const column = index % columns;
      const row = Math.floor(index / columns);
      return {
        id: `court:${court.venueCourtId}`,
        type: 'COURT',
        courtId: court.venueCourtId,
        label: court.name,
        x: courtStartX + column * (courtWidth + courtGapX),
        y: courtStartY + row * (courtHeight + 35),
        width: courtWidth,
        height: courtHeight,
        rotation: 0,
        zoneId: 'zone-a'
      };
    }

    const outdoorIndex = index - 6;
    return {
      id: `court:${court.venueCourtId}`,
      type: 'COURT',
      courtId: court.venueCourtId,
      label: court.name,
      x: 790,
      y: 80 + outdoorIndex * 180,
      width: 165,
      height: 145,
      rotation: 0,
      zoneId: 'zone-b'
    };
  });

  const facilities: FacilityLayoutItem[] = [
    { id: 'facility:locker', type: 'LOCKER', label: 'LOCKER', x: 25, y: 55, width: 100, height: 90, rotation: 0, zoneId: 'zone-a' },
    { id: 'facility:wc', type: 'WC', label: 'WC NAM', x: 25, y: 145, width: 100, height: 90, rotation: 0, zoneId: 'zone-a' },
    { id: 'facility:wc-female', type: 'WC', label: 'WC NỮ', x: 25, y: 235, width: 100, height: 90, rotation: 0, zoneId: 'zone-a' },
    { id: 'facility:storage', type: 'STORAGE', label: 'P. TẮM', x: 25, y: 325, width: 100, height: 90, rotation: 0, zoneId: 'zone-a', icon: 'droplets' },
    { id: 'facility:reception', type: 'RECEPTION', label: 'RECEPTION', x: 45, y: 465, width: 170, height: 90, rotation: 0, zoneId: 'zone-a' },
    { id: 'facility:waiting', type: 'WAITING', label: 'WAITING AREA', x: 225, y: 465, width: 270, height: 90, rotation: 0, zoneId: 'zone-a' },
    { id: 'facility:cafe', type: 'CAFE', label: 'CAFE', x: 505, y: 465, width: 220, height: 90, rotation: 0, zoneId: 'zone-a' },
    { id: 'facility:entrance', type: 'ENTRANCE', label: 'ENTRANCE', x: 405, y: 555, width: 150, height: 55, rotation: 0 },
    { id: 'facility:parking', type: 'PARKING', label: 'PARKING', x: 15, y: 600, width: 970, height: 85, rotation: 0 }
  ];

  return {
    version: 1,
    venueId,
    items: [...courtItems, ...facilities],
    zones: [
      { id: 'zone-a', name: 'ZONE A – KHU TRONG NHÀ', x: 25, y: 25, width: 725, height: 545 },
      { id: 'zone-b', name: 'ZONE B – KHU NGOÀI TRỜI', x: 765, y: 25, width: 210, height: 545 }
    ],
    updatedAt: new Date().toISOString()
  };
}

export function cloneFacilityLayout(layout: VenueFacilityLayout): VenueFacilityLayout {
  return {
    ...layout,
    items: layout.items.map(item => ({ ...item })),
    zones: layout.zones.map(zone => ({ ...zone }))
  };
}
