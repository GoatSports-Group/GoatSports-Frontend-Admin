import {
  OwnerApplication,
  OwnerApplicationStatus
} from '@application/dto/owner-application/owner-application.dto';
import { canonicalProvince } from '@shared/constants/vn-provinces';
import { ApplicationPlace, ProvinceBreakdownItem, VenueMapMarker } from './dashboard.models';

export const HCM_CENTER: [number, number] = [10.7760, 106.7009];

const VIETNAMESE_WEEKDAYS = [
  'Chủ Nhật',
  'Thứ Hai',
  'Thứ Ba',
  'Thứ Tư',
  'Thứ Năm',
  'Thứ Sáu',
  'Thứ Bảy'
];

const UNKNOWN_PLACE = 'Chưa xác định';
export const UNKNOWN_PROVINCE = 'Chưa rõ tỉnh / thành';

/**
 * Tên tỉnh / thành chuẩn theo danh sách VN_PROVINCES ("Thành phố Hà Nội", "TP. Hà Nội", "Ha Noi" là một nơi).
 * Giá trị người dùng gõ bừa (vd. "a") gom vào "Chưa rõ tỉnh / thành" thay vì thành một tỉnh riêng.
 * (Hàm cũ gom theo quận dùng /(quận|q\.|q)/i nên còn xóa nhầm chữ "q" đầu tiên: "Quy Nhơn" thành "uy Nhơn".)
 */
export function provinceName(city: string | null | undefined): string {
  return canonicalProvince(city) ?? UNKNOWN_PROVINCE;
}

export function buildProvinceBreakdown(applications: OwnerApplication[]): ProvinceBreakdownItem[] {
  const provinces = new Map<string, Map<string, ApplicationPlace[]>>();
  for (const app of applications) {
    const province = provinceName(app.address?.city);
    const district = app.address?.district?.trim() || UNKNOWN_PLACE;
    const districts = provinces.get(province) ?? new Map<string, ApplicationPlace[]>();
    districts.set(district, [
      ...(districts.get(district) ?? []),
      { businessName: app.businessName, fullName: app.fullName, status: app.status }
    ]);
    provinces.set(province, districts);
  }
  return [...provinces.entries()]
    .map(([name, districts]) => ({
      name,
      count: [...districts.values()].reduce((sum, items) => sum + items.length, 0),
      districts: [...districts.entries()]
        .map(([district, items]) => ({ name: district, applications: items }))
        .sort((a, b) => b.applications.length - a.applications.length || a.name.localeCompare(b.name, 'vi'))
    }))
    // Nhóm không rõ tỉnh luôn xếp cuối, dù đông hồ sơ.
    .sort((a, b) => Number(a.name === UNKNOWN_PROVINCE) - Number(b.name === UNKNOWN_PROVINCE)
      || b.count - a.count || a.name.localeCompare(b.name, 'vi'));
}

export function createVenueMapMarker(app: OwnerApplication, index: number): VenueMapMarker {
  const rawLat = app.address?.latitude;
  const rawLng = app.address?.longitude;
  const lat = Number(rawLat);
  const lng = Number(rawLng);
  const hasCoordinates = rawLat != null
    && rawLng != null
    && hasValidCoordinates(lat, lng);
  const district = app.address?.district?.trim() || 'Chưa xác định';
  const addressParts = [
    app.address?.address,
    app.address?.ward,
    district,
    app.address?.city
  ].map(part => part?.trim()).filter((part): part is string => Boolean(part));
  const fallbackCoordinates = getHcmFallbackCoordinates(index);

  return {
    lat: hasCoordinates ? lat : fallbackCoordinates[0],
    lng: hasCoordinates ? lng : fallbackCoordinates[1],
    businessName: app.businessName,
    fullName: app.fullName,
    addressText: [...new Set(addressParts)].join(', ') || 'Chưa có thông tin địa chỉ',
    status: app.status,
    district,
    isFallback: !hasCoordinates
  };
}

export function getVenueMarkerColor(status: OwnerApplicationStatus): string {
  if (status === OwnerApplicationStatus.PENDING) return '#f59e0b';
  if (status === OwnerApplicationStatus.REJECTED) return '#ef4444';
  // Trước đây hồ sơ đã hủy rơi xuống nhánh mặc định và tô xanh như hồ sơ đã duyệt.
  if (status === OwnerApplicationStatus.CANCELLED) return '#94a3b8';
  return '#10b981';
}

export function buildVenueTooltipContent(marker: VenueMapMarker): string {
  const locationNotice = marker.isFallback
    ? '<span class="block text-[10px] text-amber-600 font-bold leading-snug mt-1">Chưa xác định được vị trí sân.</span>'
    : '';

  return `
    <div class="p-2 select-none font-display">
      <strong class="block text-xs font-black text-emerald-600">${escapeHtml(marker.businessName)}</strong>
      <span class="block text-[12px] text-slate-500 font-bold mt-0.5">Chủ sở hữu: ${escapeHtml(marker.fullName)}</span>
      <span class="block text-[10px] text-slate-500 font-medium leading-snug mt-1">${escapeHtml(marker.addressText)}</span>
      ${locationNotice}
    </div>
  `;
}

function getHcmFallbackCoordinates(index: number): [number, number] {
  if (index === 0) return HCM_CENTER;

  const position = index - 1;
  const pointsPerRing = 8;
  const ring = Math.floor(position / pointsPerRing) + 1;
  const angle = (position % pointsPerRing) * (Math.PI * 2 / pointsPerRing);
  const radius = Math.min(0.03, ring * 0.006);

  return [
    HCM_CENTER[0] + Math.sin(angle) * radius,
    HCM_CENTER[1] + Math.cos(angle) * radius
  ];
}

function hasValidCoordinates(lat: number, lng: number): boolean {
  return Number.isFinite(lat)
    && Number.isFinite(lng)
    && lat >= -90
    && lat <= 90
    && lng >= -180
    && lng <= 180
    && !(lat === 0 && lng === 0);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  })[character] || character);
}
