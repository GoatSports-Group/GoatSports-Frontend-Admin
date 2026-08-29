import { TestBed } from '@angular/core/testing';
import {
  LucideAlertTriangle,
  LucideCloud,
  LucideMapPin,
  LucideRotateCcw,
  provideLucideIcons
} from '@lucide/angular';
import { describe, expect, it, vi } from 'vitest';
import { WeatherWidgetComponent } from './weather-widget.component';

describe('WeatherWidgetComponent', () => {
  async function createComponent() {
    await TestBed.configureTestingModule({
      imports: [WeatherWidgetComponent],
      providers: [
        provideLucideIcons(
          LucideAlertTriangle,
          LucideCloud,
          LucideMapPin,
          LucideRotateCcw
        )
      ]
    }).compileComponents();

    return TestBed.createComponent(WeatherWidgetComponent);
  }

  it('hiển thị skeleton khi đang tải và chưa có dữ liệu', async () => {
    const fixture = await createComponent();
    fixture.componentRef.setInput('loading', true);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="status"]')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Đang tải thời tiết');
  });

  it('hiển thị dữ liệu thời tiết thật và địa điểm', async () => {
    const fixture = await createComponent();
    fixture.componentRef.setInput('weather', {
      temp: 29,
      condition: 'cloudy',
      icon: 'cloud',
      description: 'Có mây nhẹ'
    });
    fixture.componentRef.setInput('location', 'TP. Hồ Chí Minh');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('29');
    expect(fixture.nativeElement.textContent).toContain('Có mây nhẹ');
    expect(fixture.nativeElement.textContent).toContain('TP. Hồ Chí Minh');
  });

  it('hiển thị lỗi thật và phát sự kiện thử lại', async () => {
    const fixture = await createComponent();
    const retrySpy = vi.fn();
    fixture.componentInstance.retry.subscribe(retrySpy);
    fixture.componentRef.setInput('error', 'Không thể kết nối dịch vụ thời tiết.');
    fixture.detectChanges();

    const retryButton = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Không thể kết nối dịch vụ thời tiết.');

    retryButton.click();
    expect(retrySpy).toHaveBeenCalledOnce();
  });
});
