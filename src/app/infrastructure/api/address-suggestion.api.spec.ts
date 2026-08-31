import { describe, expect, it } from 'vitest';
import { mapVietMapSuggestion, mergeVietMapPlace } from './address-suggestion.mapper';

describe('VietMap address mapping', () => {
  it('maps current boundaries and falls back to the legacy district', () => {
    const suggestion = mapVietMapSuggestion({
      ref_id: 'auto:new-address',
      name: '12 Nguyễn Văn Bảo',
      display: '12 Nguyễn Văn Bảo, Phường Hạnh Thông, Thành Phố Hồ Chí Minh',
      boundaries: [
        { type: 2, name: 'Hạnh Thông', full_name: 'Phường Hạnh Thông' },
        { type: 0, name: 'Hồ Chí Minh', full_name: 'Thành Phố Hồ Chí Minh' }
      ],
      data_old: {
        ref_id: 'auto:old-address',
        boundaries: [
          { type: 2, name: '4' },
          { type: 1, name: 'Gò Vấp', full_name: 'Quận Gò Vấp' },
          { type: 0, name: 'Hồ Chí Minh' }
        ]
      }
    });

    expect(suggestion).toMatchObject({
      address: '12 Nguyễn Văn Bảo',
      ward: 'Hạnh Thông',
      district: 'Gò Vấp',
      city: 'Hồ Chí Minh',
      latitude: null,
      longitude: null
    });
  });

  it('merges Place v4 coordinates while preserving the legacy district fallback', () => {
    const suggestion = mapVietMapSuggestion({
      ref_id: 'auto:new-address',
      name: '12 Nguyễn Văn Bảo',
      display: '12 Nguyễn Văn Bảo, Phường Hạnh Thông, Thành Phố Hồ Chí Minh',
      boundaries: [{ type: 2, name: 'Hạnh Thông' }, { type: 0, name: 'Hồ Chí Minh' }],
      data_old: { boundaries: [{ type: 1, name: 'Gò Vấp' }] }
    })!;

    expect(mergeVietMapPlace(suggestion, {
      display: '12 Nguyễn Văn Bảo, Phường Hạnh Thông, Thành phố Hồ Chí Minh',
      address: '12 Nguyễn Văn Bảo',
      ward: 'Phường Hạnh Thông',
      district: '',
      city: 'Thành Phố Hồ Chí Minh',
      lat: 10.8223582,
      lng: 106.6875313
    })).toMatchObject({
      address: '12 Nguyễn Văn Bảo, Phường Hạnh Thông, Thành phố Hồ Chí Minh',
      ward: 'Hạnh Thông',
      district: 'Gò Vấp',
      city: 'Hồ Chí Minh',
      latitude: 10.8223582,
      longitude: 106.6875313
    });
  });
});
