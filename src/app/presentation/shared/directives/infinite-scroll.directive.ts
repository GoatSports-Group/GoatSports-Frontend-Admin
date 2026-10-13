import { PAGE_SIZE } from '@shared/constants/page-size';
import { Directive, ElementRef, EventEmitter, OnDestroy, OnInit, Output, inject } from '@angular/core';

/** So dong hien them moi lan cham day voi danh sach da co san o client. */
export const LIST_CHUNK = PAGE_SIZE.streamLight;

/**
 * Dat tren phan tu "sentinel" cuoi danh sach: phat `reached` khi no sap vao man hinh.
 * Sau moi lan phat, quan sat lai o frame sau: neu sentinel van trong tam (danh sach ngan)
 * thi phat tiep cho toi khi day khung. Ben goi tu chan khi dang tai (hoac an sentinel).
 */
@Directive({
  selector: '[appInfiniteScroll]',
  standalone: true
})
export class InfiniteScrollDirective implements OnInit, OnDestroy {
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private observer?: IntersectionObserver;

  @Output() readonly reached = new EventEmitter<void>();

  ngOnInit(): void {
    if (typeof IntersectionObserver === 'undefined') return;
    this.observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      this.reached.emit();
      this.observer?.unobserve(this.element.nativeElement);
      requestAnimationFrame(() => this.observer?.observe(this.element.nativeElement));
    }, { root: scrollRoot(this.element.nativeElement), rootMargin: '400px 0px' });
    this.observer.observe(this.element.nativeElement);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    this.observer = undefined;
  }
}

/**
 * Khung cuộn gần nhất (overflow-y auto / scroll): danh sách nằm trong khung giới hạn chiều cao (vd "Lịch sử sự cố")
 * thì tải thêm khi cuộn trong khung đó, và lề 400px tính theo khung chứ không theo cả trang. Không có thì là viewport.
 */
function scrollRoot(element: HTMLElement): Element | null {
  for (let node = element.parentElement; node; node = node.parentElement) {
    const overflow = getComputedStyle(node).overflowY;
    // Chỉ khung thật sự cuộn dọc: phần tử cuộn ngang (.table-wrap) cũng có overflow-y "auto" nhưng không cuộn dọc,
    // lấy nó làm gốc thì sentinel luôn "trong khung" và danh sách tải liên tục.
    if ((overflow === 'auto' || overflow === 'scroll' || overflow === 'overlay') && node.scrollHeight > node.clientHeight) return node;
  }
  return null;
}
