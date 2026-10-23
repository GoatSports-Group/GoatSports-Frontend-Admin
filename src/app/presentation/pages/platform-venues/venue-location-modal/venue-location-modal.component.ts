import {
  AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, OnDestroy, input, output, viewChild
} from '@angular/core';
import { LucideIconComponent } from '@shared/components/ui/lucide-icon/lucide-icon.component';
import { loadLeaflet } from '@shared/utils/leaflet-loader';

/** Một địa điểm cần xem trên bản đồ: sân ngoài hệ thống hoặc sân người chơi gợi ý. */
export interface VenueLocation {
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
}

/**
 * Popup bản đồ (không mở tab mới) cho tab Sân tiềm năng và Gợi ý sân: ghim sân trên nền OSM, kèm link Google Maps
 * theo toạ độ. Dùng toạ độ chứ không dùng địa chỉ, vì nhiều sân OSM không có địa chỉ, còn toạ độ thì sân nào cũng có.
 */
@Component({
  selector: 'app-venue-location-modal',
  templateUrl: './venue-location-modal.component.html',
  styleUrls: ['./venue-location-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [LucideIconComponent]
})
export class VenueLocationModalComponent implements AfterViewInit, OnDestroy {
  readonly location = input.required<VenueLocation>();
  readonly closed = output<void>();

  private readonly mapElement = viewChild<ElementRef<HTMLElement>>('locationMap');
  private map: any;

  googleMapsUrl(): string {
    const { latitude, longitude } = this.location();
    return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
  }

  directionsUrl(): string {
    const { latitude, longitude } = this.location();
    return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
  }

  ngAfterViewInit(): void {
    void loadLeaflet().then(L => {
      const element = this.mapElement()?.nativeElement;
      if (!element || this.map) return;
      const { latitude, longitude, name } = this.location();
      this.map = L.map(element, { zoomControl: true }).setView([latitude, longitude], 17);
      L.tileLayer('https://tile.openstreetmap.de/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(this.map);
      L.circleMarker([latitude, longitude], {
        radius: 10, color: '#ffffff', weight: 3, fillColor: '#047857', fillOpacity: 1
      }).addTo(this.map).bindTooltip(name, { permanent: true, direction: 'top', offset: [0, -10] });
      // Popup vừa hiện thì khung bản đồ mới có kích thước thật.
      requestAnimationFrame(() => this.map?.invalidateSize());
    });
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }
}
