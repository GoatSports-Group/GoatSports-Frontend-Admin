import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription, finalize } from 'rxjs';
import { DemandForecastHour, VenueDemandForecast } from '@application/dto/demand-forecast/demand-forecast.dto';
import { GetVenueDemandForecastUseCase } from '@application/usecase/demand-forecast/get-venue-demand-forecast.usecase';
import { LucideIconComponent } from '@shared/components/ui/lucide-icon/lucide-icon.component';

interface ForecastCell extends DemandForecastHour {
  hour: number;
  label: string;
}

interface ForecastDay {
  key: string;
  label: string;
  extended: boolean;
  cells: (ForecastCell | null)[];
}

const WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const BUSY = 0.6;
const QUIET = 0.3;
/** Dưới mức này coi như 0: ô để trống thay vì ghi "0". */
const NEGLIGIBLE = 0.005;
/** Cả tuần dự báo đều dưới 1%: lịch sử quá ít lượt đặt, hai ô đông / vắng không còn ý nghĩa. */
const SPARSE = 0.01;

/**
 * Dự báo nhu cầu đặt sân 7 ngày tới (ai-service, Chronos-Bolt): bảng nhiệt ngày × giờ mở cửa theo trung vị,
 * khoảng 10–90% trong tooltip, ngày dự báo chạy nối được đánh dấu, cuối thẻ là điểm kiểm chứng trên tuần vừa qua.
 */
@Component({
  selector: 'app-owner-demand-forecast',
  standalone: true,
  imports: [LucideIconComponent],
  templateUrl: './owner-demand-forecast.component.html',
  styleUrl: './owner-demand-forecast.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OwnerDemandForecastComponent {
  private readonly getForecast = inject(GetVenueDemandForecastUseCase);
  private readonly destroyRef = inject(DestroyRef);
  private request?: Subscription;

  readonly venueId = input<string | null>(null);
  readonly forecast = signal<VenueDemandForecast | null>(null);
  readonly loading = signal(false);
  readonly error = signal<{ insufficient: boolean; message: string } | null>(null);

  readonly hoursOfDay = computed(() => {
    const forecast = this.forecast();
    const open = this.hourOf(forecast?.openTime);
    const close = this.hourOf(forecast?.closeTime);
    if (open === null || close === null || close <= open) return Array.from({ length: 24 }, (_, hour) => hour);
    // Giờ đóng cửa 22:00 nghĩa là khung cuối là 21:00–22:00.
    return Array.from({ length: close - open }, (_, index) => open + index);
  });

  readonly days = computed<ForecastDay[]>(() => {
    const forecast = this.forecast();
    if (!forecast) return [];
    const byDay = new Map<string, Map<number, DemandForecastHour>>();
    for (const hour of forecast.hours) {
      const key = hour.start.slice(0, 10);
      if (!byDay.has(key)) byDay.set(key, new Map());
      byDay.get(key)!.set(Number(hour.start.slice(11, 13)), hour);
    }
    return [...byDay.entries()].map(([key, hours]) => {
      const date = new Date(`${key}T00:00:00`);
      const label = `${WEEKDAYS[date.getDay()]} ${key.slice(8, 10)}/${key.slice(5, 7)}`;
      const cells = this.hoursOfDay().map(hour => {
        const value = hours.get(hour);
        return value ? { ...value, hour, label: `${label} ${String(hour).padStart(2, '0')}:00` } : null;
      });
      return { key, label, extended: [...hours.values()].every(item => item.extended), cells };
    }).filter(day => day.cells.some(cell => cell !== null));
  });

  readonly sparse = computed(() => {
    const forecast = this.forecast();
    return !!forecast && forecast.hours.every(hour => hour.upper < SPARSE);
  });

  /** Giờ đông nhất trong 7 ngày và giờ vắng nhất (trong giờ mở cửa) của 3 ngày đầu, phần tin cậy nhất. */
  readonly peak = computed(() => this.extreme(this.days(), (a, b) => b.median - a.median));
  readonly quiet = computed(() => this.extreme(this.days().filter(day => !day.extended), (a, b) => a.median - b.median));

  constructor() {
    effect(() => {
      const venueId = this.venueId();
      this.load(venueId);
    });
  }

  load(venueId = this.venueId()): void {
    this.request?.unsubscribe();
    this.forecast.set(null);
    this.error.set(null);
    if (!venueId) return;
    this.loading.set(true);
    this.request = this.getForecast.execute(venueId).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.loading.set(false))
    ).subscribe({
      next: forecast => this.forecast.set(forecast),
      error: (error: unknown) => this.error.set(this.describe(error))
    });
  }

  cellColor(cell: ForecastCell): string {
    return `color-mix(in srgb, var(--primary) ${Math.round(8 + cell.median * 92)}%, var(--surface))`;
  }

  cellValue(cell: ForecastCell): string {
    return cell.median < NEGLIGIBLE ? '' : (cell.median * 100).toFixed(0);
  }

  cellTone(cell: ForecastCell): 'busy' | 'normal' | 'quiet' {
    return cell.median >= BUSY ? 'busy' : cell.median < QUIET ? 'quiet' : 'normal';
  }

  cellTitle(cell: ForecastCell): string {
    const certainty = cell.extended ? ' · ngày xa, kém chắc chắn hơn' : '';
    return `${cell.label} · dự kiến ${this.percent(cell.median)} (khoảng ${this.percent(cell.lower)}–${this.percent(cell.upper)})${certainty}`;
  }

  percent(value: number): string {
    return `${Math.round(value * 100)}%`;
  }

  points(value: number): string {
    return `${(value * 100).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} điểm %`;
  }

  private extreme(days: ForecastDay[], order: (a: ForecastCell, b: ForecastCell) => number): ForecastCell | null {
    const cells = days.flatMap(day => day.cells.filter((cell): cell is ForecastCell => cell !== null));
    return cells.length ? [...cells].sort(order)[0] : null;
  }

  private hourOf(value: string | null | undefined): number | null {
    const match = /^(\d{2}):/.exec(value ?? '');
    return match ? Number(match[1]) : null;
  }

  private describe(error: unknown): { insufficient: boolean; message: string } {
    const status = (error as { status?: number } | null)?.status;
    if (status === 422) {
      return { insufficient: true, message: 'Cơ sở cần ít nhất 1 ngày dữ liệu đặt sân để dự báo.' };
    }
    if (status === 404) {
      return { insufficient: false, message: 'Không tìm thấy cơ sở này trong tài khoản của bạn.' };
    }
    return { insufficient: false, message: 'Chưa dự báo được lúc này. Thử lại sau ít phút.' };
  }
}
