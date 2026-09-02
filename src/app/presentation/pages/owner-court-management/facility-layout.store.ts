import { Injectable } from '@angular/core';
import { OwnerVenueCourt } from '@application/dto/venue-owner-dashboard/venue-owner-dashboard.dto';
import {
  FacilityLayoutItem,
  VenueFacilityLayout,
  cloneFacilityLayout,
  createAutomaticFacilityLayout
} from './facility-layout.models';

@Injectable({ providedIn: 'root' })
export class FacilityLayoutStore {
  load(
    venueId: string,
    courts: OwnerVenueCourt[],
    persisted: VenueFacilityLayout | null = null
  ): VenueFacilityLayout {
    const fallback = createAutomaticFacilityLayout(venueId, courts);
    if (!persisted || persisted.version !== 1 || persisted.venueId !== venueId || !Array.isArray(persisted.items)) {
      return fallback;
    }
    return this.reconcile(persisted, fallback, courts);
  }

  private reconcile(
    stored: VenueFacilityLayout,
    fallback: VenueFacilityLayout,
    courts: OwnerVenueCourt[]
  ): VenueFacilityLayout {
    const courtIds = new Set(courts.map(court => court.venueCourtId));
    const currentItems = stored.items
      .filter(item => item.type !== 'COURT' || (item.courtId && courtIds.has(item.courtId)))
      .map(item => item.id === 'facility:storage' && item.label === 'WC NỮ · P. TẮM'
        ? { ...item, label: 'P. TẮM', icon: 'droplets' }
        : item);
    const placedCourtIds = new Set(currentItems.filter(item => item.type === 'COURT').map(item => item.courtId));
    const missingCourts = fallback.items.filter(item => item.type === 'COURT' && !placedCourtIds.has(item.courtId));
    const hasLegacyCombinedBathroom = stored.items.some(item => item.id === 'facility:storage' && item.label === 'WC NỮ · P. TẮM');
    const missingFemaleBathroom = hasLegacyCombinedBathroom && !currentItems.some(item => item.id === 'facility:wc-female')
      ? fallback.items.filter(item => item.id === 'facility:wc-female')
      : [];
    return {
      ...cloneFacilityLayout(stored),
      items: [
        ...currentItems,
        ...missingCourts.map((item): FacilityLayoutItem => ({ ...item })),
        ...missingFemaleBathroom.map((item): FacilityLayoutItem => ({ ...item }))
      ],
      zones: Array.isArray(stored.zones) && stored.zones.length ? stored.zones.map(zone => ({ ...zone })) : fallback.zones
    };
  }
}
