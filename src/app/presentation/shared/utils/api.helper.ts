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
