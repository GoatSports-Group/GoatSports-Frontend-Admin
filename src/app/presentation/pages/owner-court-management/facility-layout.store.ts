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
  private readonly prefix = 'goatsports:owner-facility-layout:v1:';

  load(venueId: string, courts: OwnerVenueCourt[]): VenueFacilityLayout {
    const fallback = createAutomaticFacilityLayout(venueId, courts);
    const storage = this.storage();
    if (!storage) return fallback;

    try {
      const value = storage.getItem(`${this.prefix}${venueId}`);
      if (!value) return fallback;
      const parsed = JSON.parse(value) as VenueFacilityLayout;
      if (parsed.version !== 1 || parsed.venueId !== venueId || !Array.isArray(parsed.items)) return fallback;
      return this.reconcile(parsed, fallback, courts);
    } catch {
      return fallback;
    }
  }

  save(layout: VenueFacilityLayout): VenueFacilityLayout {
    const saved = { ...cloneFacilityLayout(layout), updatedAt: new Date().toISOString() };
    this.storage()?.setItem(`${this.prefix}${layout.venueId}`, JSON.stringify(saved));
    return saved;
  }

  clear(venueId: string): void {
    this.storage()?.removeItem(`${this.prefix}${venueId}`);
  }

  private storage(): Storage | null {
    if (typeof window === 'undefined') return null;
    try { return window.localStorage; }
    catch { return null; }
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
