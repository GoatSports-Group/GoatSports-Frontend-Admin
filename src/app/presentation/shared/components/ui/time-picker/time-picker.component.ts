import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, EventEmitter, Input, Output, forwardRef, inject } from '@angular/core';
import { ConnectedPosition, OverlayModule } from '@angular/cdk/overlay';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

const pad = (value: number) => String(value).padStart(2, '0');

/**
 * Chon gio thay cho <input type="time"> (popup native khac nhau theo trinh duyet, co AM/PM). Gia tri "HH:mm" 24 gio
 * giong input native nen thay vao formControlName / [(ngModel)] khong phai doi model. Popup la CDK overlay nhu
 * app-date-picker: hai cot Gio / Phut, bam mot gio + mot phut la xong.
 */
@Component({
  selector: 'app-time-picker',
  standalone: true,
  imports: [OverlayModule],
  templateUrl: './time-picker.component.html',
  styleUrl: './time-picker.component.scss',
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => TimePickerComponent), multi: true }],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TimePickerComponent implements ControlValueAccessor {
  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly changeDetector = inject(ChangeDetectorRef);

  @Input() placeholder = '--:--';
  @Input() ariaLabel = 'Chọn giờ';
  @Input() disabled = false;
  /** Buoc phut trong cot Phut (vd. 5, 15, 30). */
  @Input() minuteStep = 5;

  @Output() readonly timeChange = new EventEmitter<string>();

  readonly hours = Array.from({ length: 24 }, (_, hour) => pad(hour));
  readonly positions: ConnectedPosition[] = [
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 6 },
    { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -6 }
  ];

  value = '';
  open = false;

  private onChange: (value: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  get minutes(): string[] {
    const step = Math.min(30, Math.max(1, Math.floor(this.minuteStep) || 5));
    const values = Array.from({ length: Math.ceil(60 / step) }, (_, index) => pad(index * step));
    // Gia tri dang co le buoc (vd. 07:10 voi buoc 15) van phai chon lai duoc.
    const current = this.value.slice(3, 5);
    return current && !values.includes(current) ? [...values, current].sort() : values;
  }

  get hour(): string { return this.value.slice(0, 2); }
  get minute(): string { return this.value.slice(3, 5); }

  toggle(): void {
    if (this.disabled) return;
    if (this.open) {
      this.close();
      return;
    }
    this.open = true;
    // Cuon cot toi gia tri dang chon sau khi overlay ve xong.
    requestAnimationFrame(() => document.querySelectorAll<HTMLElement>('.time-picker__col .is-selected')
      .forEach(item => item.scrollIntoView({ block: 'center' })));
  }

  close(): void {
    if (!this.open) return;
    this.open = false;
    this.onTouched();
    this.changeDetector.markForCheck();
  }

  pickHour(hour: string): void {
    this.commit(`${hour}:${this.minute || '00'}`);
  }

  pickMinute(minute: string): void {
    this.commit(`${this.hour || '00'}:${minute}`);
    this.close();
    this.elementRef.nativeElement.querySelector<HTMLButtonElement>('.time-picker__trigger')?.focus();
  }

  onOutsideClick(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target as Node)) this.close();
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
      this.elementRef.nativeElement.querySelector<HTMLButtonElement>('.time-picker__trigger')?.focus();
    }
  }

  writeValue(value: string | null | undefined): void {
    const match = /^(\d{2}):(\d{2})/.exec(value ?? '');
    this.value = match ? `${match[1]}:${match[2]}` : '';
    this.changeDetector.markForCheck();
  }

  registerOnChange(fn: (value: string) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }

  setDisabledState(disabled: boolean): void {
    this.disabled = disabled;
    if (disabled) this.open = false;
    this.changeDetector.markForCheck();
  }

  private commit(value: string): void {
    if (value === this.value) return;
    this.value = value;
    this.onChange(value);
    this.timeChange.emit(value);
    this.changeDetector.markForCheck();
  }
}
