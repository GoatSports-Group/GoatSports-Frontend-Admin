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
  const courtStartX = columns === 2 ? 225 : 205;
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
    { id: 'facility:locker', type: 'LOCKER', label: 'Locker', x: 45, y: 80, width: 135, height: 95, rotation: 0, zoneId: 'zone-a' },
    { id: 'facility:wc', type: 'WC', label: 'WC', x: 45, y: 190, width: 135, height: 95, rotation: 0, zoneId: 'zone-a' },
    { id: 'facility:storage', type: 'STORAGE', label: 'Kho', x: 45, y: 300, width: 135, height: 95, rotation: 0, zoneId: 'zone-a' },
    { id: 'facility:reception', type: 'RECEPTION', label: 'Lễ tân', x: 100, y: 465, width: 170, height: 90, rotation: 0, zoneId: 'zone-a' },
    { id: 'facility:waiting', type: 'WAITING', label: 'Khu chờ', x: 300, y: 465, width: 190, height: 90, rotation: 0, zoneId: 'zone-a' },
    { id: 'facility:cafe', type: 'CAFE', label: 'Cafe', x: 520, y: 465, width: 190, height: 90, rotation: 0, zoneId: 'zone-a' },
    { id: 'facility:entrance', type: 'ENTRANCE', label: 'Cổng vào', x: 405, y: 555, width: 150, height: 55, rotation: 0 },
    { id: 'facility:parking', type: 'PARKING', label: 'Bãi xe', x: 100, y: 615, width: 800, height: 70, rotation: 0 }
  ];

  return {
    version: 1,
    venueId,
    items: [...courtItems, ...facilities],
    zones: [
      { id: 'zone-a', name: 'Khu A · Trong nhà', x: 25, y: 25, width: 725, height: 545 },
      { id: 'zone-b', name: 'Khu B · Ngoài trời', x: 765, y: 25, width: 210, height: 545 }
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
