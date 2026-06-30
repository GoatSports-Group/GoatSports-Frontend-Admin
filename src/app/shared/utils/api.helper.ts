import { HttpParams } from '@angular/common/http';
import { PageFilter } from '@application/dto/page.filter';

export function buildPageParams(filter: PageFilter): HttpParams {
    let params = new HttpParams()
        .set('page', filter.page.toString())
        .set('size', filter.size.toString());

    if (filter.filter && filter.filter.trim() !== '') {
        params = params.set('filter', filter.filter.trim());
    }

    return params;
}

/**
 * Ví dụ: buildRsqlSearch('admin', ['name', 'description'])
 * Kết quả trả về: "name ~ '*admin*' or description ~ '*admin*'"
 */
export function buildRsqlSearch(search: string | undefined, fields: string[]): string {
    if (!search || search.trim() === '' || fields.length === 0) {
        return '';
    }
    const cleanSearch = search.trim().replace(/'/g, "\\'").toLocaleLowerCase();
    return fields.map(field => `${field} ~~ '*${cleanSearch}*'`).join(' or ');
}
