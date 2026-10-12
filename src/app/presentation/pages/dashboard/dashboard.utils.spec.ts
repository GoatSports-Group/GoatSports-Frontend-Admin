import { describe, expect, it } from 'vitest';
import { OwnerApplication, OwnerApplicationStatus } from '@application/dto/owner-application/owner-application.dto';
import { UNKNOWN_PROVINCE, buildProvinceBreakdown, getVenueMarkerColor, provinceName } from './dashboard.utils';

function app(city: string, district: string, status: OwnerApplicationStatus, businessName = 'Sân'): OwnerApplication {
  return { businessName, fullName: 'Chủ sân', status, address: { addressId: '1', address: '', ward: '', district, city } } as OwnerApplication;
}

describe('dashboard utils', () => {
  it('normalises written forms of a province and rejects values that are not one', () => {
    expect(provinceName('Thành phố Hà Nội')).toBe('Hà Nội');
    expect(provinceName('TP. Hồ Chí Minh')).toBe('Hồ Chí Minh');
    expect(provinceName('TPHCM')).toBe('Hồ Chí Minh');
    expect(provinceName('ha noi')).toBe('Hà Nội');
    expect(provinceName('Tỉnh Quảng Ninh')).toBe('Quảng Ninh');
    expect(provinceName('Thừa Thiên Huế')).toBe('Huế');
    // Dữ liệu gõ bừa không thành một "tỉnh" riêng.
    expect(provinceName('a')).toBe(UNKNOWN_PROVINCE);
    expect(provinceName('  ')).toBe(UNKNOWN_PROVINCE);
  });

  it('puts the unknown-province group last even when it is the largest', () => {
    const result = buildProvinceBreakdown([
      app('a', 'x', OwnerApplicationStatus.REJECTED), app('a', 'y', OwnerApplicationStatus.REJECTED),
      app('Đà Nẵng', 'Sơn Trà', OwnerApplicationStatus.APPROVED)
    ]);
    expect(result.map(item => item.name)).toEqual(['Đà Nẵng', UNKNOWN_PROVINCE]);
  });

  it('groups applications by province, then district, busiest first', () => {
    const result = buildProvinceBreakdown([
      app('Thành phố Hà Nội', 'Nam Từ Liêm', OwnerApplicationStatus.APPROVED, 'Sân Tennis Mỹ Đình'),
      app('Hà Nội', 'Đông Anh', OwnerApplicationStatus.REJECTED, 'Ken'),
      app('Hồ Chí Minh', 'Bình Thạnh', OwnerApplicationStatus.APPROVED),
      app('TP. Hồ Chí Minh', 'Bình Thạnh', OwnerApplicationStatus.PENDING),
      app('Hồ Chí Minh', 'Gò Vấp', OwnerApplicationStatus.APPROVED)
    ]);

    expect(result.map(item => [item.name, item.count])).toEqual([['Hồ Chí Minh', 3], ['Hà Nội', 2]]);
    expect(result[0].districts.map(item => [item.name, item.applications.length])).toEqual([['Bình Thạnh', 2], ['Gò Vấp', 1]]);
    expect(result[1].districts.find(item => item.name === 'Đông Anh')?.applications[0])
      .toEqual({ businessName: 'Ken', fullName: 'Chủ sân', status: OwnerApplicationStatus.REJECTED });
  });

  it('colours cancelled applications grey instead of approved green', () => {
    expect(getVenueMarkerColor(OwnerApplicationStatus.CANCELLED)).not.toBe(getVenueMarkerColor(OwnerApplicationStatus.APPROVED));
    expect(getVenueMarkerColor(OwnerApplicationStatus.REJECTED)).toBe('#ef4444');
  });
});
