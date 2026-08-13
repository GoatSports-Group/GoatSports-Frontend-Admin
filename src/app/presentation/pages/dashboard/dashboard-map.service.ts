import { Injectable } from '@angular/core';
import { VenueMapMarker } from './dashboard.models';
import { HCM_CENTER, buildVenueTooltipContent, getVenueMarkerColor } from './dashboard.utils';

@Injectable()
export class DashboardMapService {
  private map: any;
  private markersGroup: any;
  private elementId = '';
  private pendingMarkers: VenueMapMarker[] = [];

  init(elementId: string): void {
    this.elementId = elementId;
    if ((window as any).L) {
      this.createMap();
      return;
    }

    this.loadLeafletAssets();
  }

  render(markers: VenueMapMarker[]): void {
    this.pendingMarkers = markers;
    if (!this.map || !this.markersGroup) return;

    const L = (window as any).L;
    const bounds: Array<[number, number]> = [];
    this.markersGroup.clearLayers();

    markers.forEach(marker => {
      const color = getVenueMarkerColor(marker.status);
      const icon = L.divIcon({
        className: 'custom-leaflet-marker',
        html: this.createMarkerHtml(color),
        iconSize: [16, 16],
        iconAnchor: [8, 8]
      });

      L.marker([marker.lat, marker.lng], { icon })
        .bindTooltip(buildVenueTooltipContent(marker), {
          direction: 'top',
          offset: [0, -10],
          opacity: 1,
          className: 'venue-map-tooltip'
        })
        .addTo(this.markersGroup);
      bounds.push([marker.lat, marker.lng]);
    });

    this.fitToMarkers(bounds);
  }

  destroy(): void {
    this.map?.remove();
    this.map = null;
    this.markersGroup = null;
    this.pendingMarkers = [];
  }

  private loadLeafletAssets(): void {
    if (!document.getElementById('leaflet-dashboard-styles')) {
      const link = document.createElement('link');
      link.id = 'leaflet-dashboard-styles';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    const existingScript = document.getElementById('leaflet-dashboard-script') as HTMLScriptElement | null;
    if (existingScript) {
      existingScript.addEventListener('load', () => this.createMap(), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = 'leaflet-dashboard-script';
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.addEventListener('load', () => this.createMap(), { once: true });
    document.body.appendChild(script);
  }

  private createMap(): void {
    const L = (window as any).L;
    const element = document.getElementById(this.elementId);
    if (!L || !element || this.map) return;

    this.map = L.map(this.elementId, {
      zoomControl: true,
      attributionControl: false
    }).setView(HCM_CENTER, 11);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 19
    }).addTo(this.map);

    this.markersGroup = L.layerGroup().addTo(this.map);
    this.render(this.pendingMarkers);
  }

  private fitToMarkers(bounds: Array<[number, number]>): void {
    if (bounds.length === 1) {
      this.map.setView(bounds[0], 15);
    } else if (bounds.length > 1) {
      this.map.fitBounds(bounds, { padding: [32, 32], maxZoom: 15 });
    } else {
      this.map.setView(HCM_CENTER, 11);
    }
  }

  private createMarkerHtml(color: string): string {
    return `
      <div class="relative flex items-center justify-center">
        <span class="absolute inline-flex h-4 w-4 rounded-full opacity-60 animate-ping" style="background-color: ${color}"></span>
        <span class="relative block h-4 w-4 rounded-full border-2 border-white shadow-md" style="background-color: ${color}"></span>
      </div>
    `;
  }
}
