import { HttpParams } from '@angular/common/http';
import { PageFilter } from '@application/dto/page.filter';

export function buildPageParams(filter: PageFilter): HttpParams {
  let params = new HttpParams()
    .set('page', filter.page.toString())
    .set('size', filter.size.toString());

  if (filter.filter?.trim()) {
    params = params.set('filter', filter.filter.trim());
  }

  return params;
}
