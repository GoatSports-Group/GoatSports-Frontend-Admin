import { Observable, forkJoin, map, of, switchMap } from 'rxjs';
import { BaseListResponse } from '@application/dto/base/base-response';

/** Dòng tối đa mỗi trang mà các service chấp nhận (`spring.data.web.pageable.max-page-size`). Xin nhiều hơn vẫn chỉ nhận 20. */
export const SERVER_MAX_PAGE_SIZE = 20;

/**
 * Tải đủ mọi trang của một danh sách: trang đầu để biết số trang, các trang còn lại gọi song song.
 * `fetch` nhận chỉ số trang tính từ 0.
 * ponytail: gọi song song mọi trang, đủ cho vài trăm dòng; danh sách lớn hơn thì cần endpoint tổng hợp riêng.
 */
export function fetchAllPages<T>(fetch: (page: number) => Observable<BaseListResponse<T>>): Observable<T[]> {
  return fetch(0).pipe(
    switchMap(first => {
      const pages = first?.meta?.pages ?? 1;
      if (pages <= 1) return of(first?.result ?? []);
      return forkJoin(Array.from({ length: pages - 1 }, (_, index) => fetch(index + 1))).pipe(
        map(rest => [first, ...rest].flatMap(page => page?.result ?? []))
      );
    })
  );
}
