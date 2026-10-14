import { HttpParams } from '@angular/common/http';
import { PageFilter } from '@application/dto/page.filter';

/**
 * `filter.page` luôn tính từ 0 (như app-pagination). Service bật `spring.data.web.pageable.one-indexed-parameters`
 * (auth, venue, social, notification) đọc `page` tính từ 1: gửi `oneIndexed = true`, nếu không `page=0` và `page=1`
 * cùng ra trang đầu và trang 2 lặp lại trang 1.
 */
export function buildPageParams(filter: PageFilter, oneIndexed = false): HttpParams {
  let params = new HttpParams()
    .set('page', (filter.page + (oneIndexed ? 1 : 0)).toString())
    .set('size', filter.size.toString());

  if (filter.filter?.trim()) {
    params = params.set('filter', filter.filter.trim());
  }

  return params;
}
