import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GetVenueDemandForecastUseCase } from '@application/usecase/demand-forecast/get-venue-demand-forecast.usecase';
import { DemandForecastHour, VenueDemandForecast } from '@application/dto/demand-forecast/demand-forecast.dto';
import { provideLucideIcons } from '@lucide/angular';
import { APP_ICONS } from '../../../../app-icons';
import { OwnerDemandForecastComponent } from './owner-demand-forecast.component';

function forecast(): VenueDemandForecast {
  // Bắt đầu 10/10/2026 (thứ Bảy) 00:00; 19h đông, 7h vắng; từ giờ thứ 64 là dự báo chạy nối.
  const hours: DemandForecastHour[] = Array.from({ length: 168 }, (_, index) => {
    const date = new Date(2026, 9, 10, index);
    const hour = date.getHours();
    const median = hour === 19 ? 0.82 : hour === 7 ? 0.05 : 0.4;
    const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(hour).padStart(2, '0')}:00:00`;
    return { start: iso, lower: Math.max(0, median - 0.1), median, upper: Math.min(1, median + 0.1), extended: index >= 64 };
  });
  return {
    forecastId: 'f-1', venueId: 'venue-1', modelName: 'chronos-bolt-tiny', modelRevision: 'a0e552de83495b5c',
    generatedAt: '2026-10-09T17:00:00Z', forecastStart: hours[0].start, courtCount: 4,
    openTime: '06:00:00', closeTime: '22:00:00', historyHours: 1900, hours,
    backtest: { hours: 168, modelMae: 0.081, baselineMae: 0.124, coverage: 0.78 }
  };
}

describe('OwnerDemandForecastComponent', () => {
  let fixture: ComponentFixture<OwnerDemandForecastComponent>;
  const getForecast = { execute: vi.fn() };

  beforeEach(async () => {
    getForecast.execute.mockReset();
    await TestBed.configureTestingModule({
      imports: [OwnerDemandForecastComponent],
      providers: [provideLucideIcons(...APP_ICONS), { provide: GetVenueDemandForecastUseCase, useValue: getForecast }]
    }).compileComponents();
    fixture = TestBed.createComponent(OwnerDemandForecastComponent);
  });

  it('vẽ bảng nhiệt 7 ngày theo giờ mở cửa, đánh dấu ngày chạy nối và hiện điểm kiểm chứng', () => {
    getForecast.execute.mockReturnValue(of(forecast()));
    fixture.componentRef.setInput('venueId', 'venue-1');
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    expect(getForecast.execute).toHaveBeenCalledWith('venue-1');
    // Mở 06:00–22:00: 16 cột giờ (6h…21h), 7 hàng ngày.
    expect(root.querySelectorAll('thead th')).toHaveLength(17);
    expect(root.querySelectorAll('tbody tr')).toHaveLength(7);
    expect(root.querySelector('tbody th')?.textContent).toContain('T7 10/10');
    expect(root.querySelectorAll('td[data-tone="busy"]')).toHaveLength(7);
    expect(root.querySelectorAll('tbody tr.is-extended').length).toBeGreaterThan(0);
    expect(root.querySelector('.demand__highlight.is-busy strong')?.textContent).toContain('19:00');
    expect(root.querySelector('.demand__highlight.is-quiet strong')?.textContent).toContain('07:00');
    expect(root.querySelector('td[data-tone="busy"]')?.getAttribute('title')).toContain('khoảng 72%–92%');
    expect(root.querySelector('.demand__quality')?.textContent).toContain('8,1 điểm %');
    expect(root.querySelector('.demand__quality')?.textContent).toContain('78%');
  });

  it('báo cần thêm dữ liệu (422) mà không hiện nút thử lại', () => {
    getForecast.execute.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 422 })));
    fixture.componentRef.setInput('venueId', 'venue-1');
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('.demand__state')?.textContent).toContain('ít nhất 1 ngày dữ liệu');
    expect(root.querySelector('.demand__state button')).toBeNull();
  });
});
