import { Injectable } from '@angular/core';
import { loadLeaflet } from '@shared/utils/leaflet-loader';
import { VenueMapMarker } from './dashboard.models';
import { HCM_CENTER, buildVenueTooltipContent, getVenueMarkerColor } from './dashboard.utils';

@Injectable()
export class DashboardMapService {
  private map: any;
  private markersGroup: any;
  private elementId = '';
  private pendingMarkers: VenueMapMarker[] = [];
  private resizeObserver?: ResizeObserver;

  init(elementId: string): void {
    this.elementId = elementId;
    void loadLeaflet().then(() => this.createMap());
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
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
    this.map?.remove();
    this.map = null;
    this.markersGroup = null;
    this.pendingMarkers = [];
  }

  private createMap(): void {
    const L = (window as any).L;
    const element = document.getElementById(this.elementId);
    if (!L || !element || this.map) return;

    this.map = L.map(this.elementId, {
      zoomControl: true,
      attributionControl: true
    }).setView(HCM_CENTER, 11);

    // Cùng nguồn tile với client; CARTO basemaps giờ trả ảnh "API KEY REQUIRED" khi không có key.
    L.tileLayer('https://tile.openstreetmap.de/{z}/{x}/{y}.png', {
      maxZoom: 19,
      keepBuffer: 2,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(this.map);

    this.markersGroup = L.layerGroup().addTo(this.map);
    this.render(this.pendingMarkers);

    // Khung bản đồ giãn theo chiều cao cột bên cạnh (đổi khi số liệu về): báo Leaflet tính lại kích thước, nếu không
    // phần mới giãn ra để trống không có tile.
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.map?.invalidateSize());
      this.resizeObserver.observe(element);
    }
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
