import { Injector, Signal, WritableSignal, afterNextRender, computed, signal } from '@angular/core';
import { LIST_CHUNK } from '@shared/directives/infinite-scroll.directive';

/**
 * Cuon vo han hai chieu tren mot danh sach da co san o client: chi render toi da `max` muc. Cham day thi noi them
 * o duoi (bot o tren), cuon nguoc len dau thi noi lai o tren (bot o duoi); muc dang nhin giu nguyen vi tri nen danh
 * sach khong nhay. Moi muc can [attr.data-window-id] = id cua no; sentinel dau / cuoi dung appInfiniteScroll.
 */
export class TwoWayWindow<T> {
  readonly start: WritableSignal<number>;
  readonly end: WritableSignal<number>;
  readonly items: Signal<readonly T[]>;
  readonly hasBefore: Signal<boolean>;
  readonly hasAfter: Signal<boolean>;

  constructor(
    private readonly source: Signal<readonly T[]>,
    private readonly idOf: (item: T) => string,
    private readonly injector: Injector,
    private readonly chunk = LIST_CHUNK,
    private readonly max = LIST_CHUNK * 3
  ) {
    this.start = signal(0);
    this.end = signal(chunk);
    this.items = computed(() => this.source().slice(this.start(), this.end()));
    this.hasBefore = computed(() => this.start() > 0);
    this.hasAfter = computed(() => this.end() < this.source().length);
  }

  reset(): void {
    this.start.set(0);
    this.end.set(this.chunk);
  }

  next(list: HTMLElement | undefined): void {
    const total = this.source().length;
    if (this.end() >= total) return;
    const end = Math.min(total, this.end() + this.chunk);
    const start = Math.max(this.start(), end - this.max);
    this.move(start, end, this.source()[start], list);
  }

  previous(list: HTMLElement | undefined): void {
    if (this.start() <= 0) return;
    const anchor = this.source()[this.start()];
    const start = Math.max(0, this.start() - this.chunk);
    this.move(start, Math.min(this.end(), start + this.max), anchor, list);
  }

  /** Doi cua so render nhung giu muc `anchor` dung cho cu tren man hinh. */
  private move(start: number, end: number, anchor: T | undefined, list: HTMLElement | undefined): void {
    const anchorId = anchor === undefined ? null : this.idOf(anchor);
    const before = anchorId ? this.top(list, anchorId) : null;
    this.start.set(start);
    this.end.set(end);
    if (!list || before === null) return;
    afterNextRender(() => {
      const after = this.top(list, anchorId!);
      if (after !== null) list.scrollTop += after - before;
    }, { injector: this.injector });
  }

  private top(list: HTMLElement | undefined, id: string): number | null {
    const item = list?.querySelector<HTMLElement>(`[data-window-id="${CSS.escape(id)}"]`);
    return item ? item.getBoundingClientRect().top : null;
  }
}
