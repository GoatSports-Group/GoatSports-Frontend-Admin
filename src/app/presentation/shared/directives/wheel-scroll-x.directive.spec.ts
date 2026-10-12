import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { WheelScrollXDirective } from './wheel-scroll-x.directive';

@Component({
  standalone: true,
  imports: [WheelScrollXDirective],
  template: '<div appWheelScrollX></div>'
})
class HostComponent {}

describe('WheelScrollXDirective', () => {
  function row(scrollWidth: number, clientWidth: number, scrollLeft = 0): HTMLElement {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const element = fixture.nativeElement.querySelector('div') as HTMLElement;
    Object.defineProperty(element, 'scrollWidth', { value: scrollWidth });
    Object.defineProperty(element, 'clientWidth', { value: clientWidth });
    element.scrollLeft = scrollLeft;
    return element;
  }

  const wheel = (deltaY: number, deltaX = 0) => new WheelEvent('wheel', { deltaY, deltaX, cancelable: true });

  it('turns vertical wheel into horizontal scroll while the row can still move', () => {
    const element = row(500, 200);
    const event = wheel(100);
    element.dispatchEvent(event);
    expect(element.scrollLeft).toBe(100);
    expect(event.defaultPrevented).toBe(true);
  });

  it('lets the page scroll when the row does not overflow or is already at the edge', () => {
    const fits = wheel(100);
    row(200, 200).dispatchEvent(fits);
    expect(fits.defaultPrevented).toBe(false);

    const atEnd = wheel(100);
    const element = row(500, 200, 300);
    element.dispatchEvent(atEnd);
    expect(atEnd.defaultPrevented).toBe(false);
  });

  it('leaves trackpad horizontal swipes to the browser', () => {
    const swipe = wheel(10, 40);
    row(500, 200).dispatchEvent(swipe);
    expect(swipe.defaultPrevented).toBe(false);
  });
});
