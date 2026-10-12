/**
 * Tỉnh / thành Việt Nam (63 đơn vị trước sáp nhập 2025; tên các tỉnh mới đều nằm trong danh sách này) để chuẩn hóa
 * địa chỉ người dùng tự gõ: "TP. Hồ Chí Minh", "Ho Chi Minh", "HCM" là một nơi; giá trị không khớp (vd. "a") không
 * được coi là một tỉnh.
 */
export const VN_PROVINCES: readonly string[] = [
  'An Giang', 'Bà Rịa - Vũng Tàu', 'Bắc Giang', 'Bắc Kạn', 'Bạc Liêu', 'Bắc Ninh', 'Bến Tre', 'Bình Định',
  'Bình Dương', 'Bình Phước', 'Bình Thuận', 'Cà Mau', 'Cần Thơ', 'Cao Bằng', 'Đà Nẵng', 'Đắk Lắk', 'Đắk Nông',
  'Điện Biên', 'Đồng Nai', 'Đồng Tháp', 'Gia Lai', 'Hà Giang', 'Hà Nam', 'Hà Nội', 'Hà Tĩnh', 'Hải Dương',
  'Hải Phòng', 'Hậu Giang', 'Hòa Bình', 'Hồ Chí Minh', 'Huế', 'Hưng Yên', 'Khánh Hòa', 'Kiên Giang', 'Kon Tum',
  'Lai Châu', 'Lâm Đồng', 'Lạng Sơn', 'Lào Cai', 'Long An', 'Nam Định', 'Nghệ An', 'Ninh Bình', 'Ninh Thuận',
  'Phú Thọ', 'Phú Yên', 'Quảng Bình', 'Quảng Nam', 'Quảng Ngãi', 'Quảng Ninh', 'Quảng Trị', 'Sóc Trăng', 'Sơn La',
  'Tây Ninh', 'Thái Bình', 'Thái Nguyên', 'Thanh Hóa', 'Tiền Giang', 'Trà Vinh', 'Tuyên Quang', 'Vĩnh Long',
  'Vĩnh Phúc', 'Yên Bái'
];

/** Cách viết tắt / tên cũ thường gặp → tên chuẩn. Khóa đã bỏ dấu, viết thường, bỏ khoảng trắng và dấu câu. */
const ALIASES: Readonly<Record<string, string>> = {
  hcm: 'Hồ Chí Minh', tphcm: 'Hồ Chí Minh', hcmc: 'Hồ Chí Minh', saigon: 'Hồ Chí Minh',
  hn: 'Hà Nội', danang: 'Đà Nẵng', thuathienhue: 'Huế', brvt: 'Bà Rịa - Vũng Tàu', vungtau: 'Bà Rịa - Vũng Tàu'
};

function key(value: string): string {
  return value
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/^\s*(thanh pho|tp\.?|tinh)\s*/, '')
    .replace(/[^a-z]/g, '');
}

const BY_KEY = new Map<string, string>([
  ...VN_PROVINCES.map(name => [key(name), name] as [string, string]),
  ...Object.entries(ALIASES)
]);

/** Tên tỉnh / thành chuẩn, hoặc null khi giá trị không phải một tỉnh / thành. */
export function canonicalProvince(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  return BY_KEY.get(key(raw)) ?? null;
}
