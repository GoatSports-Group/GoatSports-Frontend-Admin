import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { environment } from '@environments/environment';
import { AddressSuggestionApi } from './address-suggestion.api';

describe('AddressSuggestionApi', () => {
  let api: AddressSuggestionApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AddressSuggestionApi, provideHttpClient(), provideHttpClientTesting()]
    });
    api = TestBed.inject(AddressSuggestionApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('tìm gợi ý qua venue-service mà không gửi VietMap API key', () => {
    const expected = [{
      id: 'auto:abc',
      refId: 'auto:abc',
      title: '12 Nguyễn Văn Bảo',
      formattedAddress: '12 Nguyễn Văn Bảo, Gò Vấp, Hồ Chí Minh',
      address: '12 Nguyễn Văn Bảo',
      ward: 'Hạnh Thông',
      district: 'Gò Vấp',
      city: 'Hồ Chí Minh',
      latitude: null,
      longitude: null
    }];

    api.search('  12 Nguyễn Văn Bảo  ').subscribe(result => expect(result).toEqual(expected));

    const request = http.expectOne(req => req.url === `${environment.apiUrl}/venue-service/api/v1/address-suggestions`);
    expect(request.request.params.get('query')).toBe('12 Nguyễn Văn Bảo');
    expect(request.request.params.has('apikey')).toBe(false);
    request.flush({ data: expected, statusCode: 200, message: 'Success', error: null });
  });

  it('lấy chi tiết địa chỉ qua backend bằng refId', () => {
    const suggestion = {
      id: 'geocode:abc', refId: 'geocode:abc', title: 'GOAT Arena',
      formattedAddress: 'GOAT Arena, Nha Trang', address: 'GOAT Arena',
      ward: '', district: '', city: 'Khánh Hòa', latitude: null, longitude: null
    };
    const resolved = { ...suggestion, latitude: 12.21, longitude: 109.19 };

    api.resolve(suggestion).subscribe(result => expect(result).toEqual(resolved));

    const request = http.expectOne(req => req.url.endsWith('/address-suggestions/resolve'));
    expect(request.request.params.get('refId')).toBe('geocode:abc');
    expect(request.request.params.has('apikey')).toBe(false);
    request.flush({ data: resolved, statusCode: 200, message: 'Success', error: null });
  });
});
