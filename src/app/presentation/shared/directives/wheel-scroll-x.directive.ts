import { Directive, ElementRef, inject } from '@angular/core';

/**
 * Hàng chip / tab một dòng tràn ngang: lăn chuột dọc thì cuộn hàng sang ngang. Tới mép rồi thì nhả cho trang cuộn
 * tiếp; trackpad vuốt ngang (deltaX) và Ctrl+lăn (zoom) giữ nguyên hành vi trình duyệt.
 */
@Directive({
  selector: '[appWheelScrollX]',
  standalone: true,
  host: { '(wheel)': 'onWheel($event)' }
})
export class WheelScrollXDirective {
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  onWheel(event: WheelEvent): void {
    if (event.ctrlKey || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
    const max = this.element.scrollWidth - this.element.clientWidth;
    if (max <= 0) return;
    const delta = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? event.deltaY * 16 : event.deltaY;
    const next = Math.min(max, Math.max(0, this.element.scrollLeft + delta));
    if (next === this.element.scrollLeft) return;
    this.element.scrollLeft = next;
    event.preventDefault();
  }
}
