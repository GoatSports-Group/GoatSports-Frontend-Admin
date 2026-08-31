import { AddressSuggestion } from '@application/dto/owner-application/address-suggestion.dto';

export interface VietMapBoundary {
  type: number;
  name?: string;
  full_name?: string;
}

export interface VietMapAutocompleteResult {
  ref_id?: string;
  name?: string;
  display?: string;
  address?: string;
  boundaries?: VietMapBoundary[];
  data_old?: VietMapAutocompleteResult | null;
  data_new?: VietMapAutocompleteResult | null;
}

export interface VietMapPlaceResult {
  display?: string;
  name?: string;
  hs_num?: string;
  street?: string;
  address?: string;
  city?: string;
  district?: string;
  ward?: string;
  lat?: number;
  lng?: number;
}

export function mapVietMapSuggestion(result: VietMapAutocompleteResult): AddressSuggestion | null {
  const refId = result.ref_id?.trim();
  const title = result.name?.trim();
  const formattedAddress = result.display?.trim() || [title, result.address].filter(Boolean).join(', ');
  if (!refId || !title || !formattedAddress) return null;

  const currentBoundaries = result.boundaries ?? [];
  const legacyBoundaries = result.data_old?.boundaries ?? [];
  return {
    id: refId,
    refId,
    title,
    formattedAddress,
    address: title,
    ward: boundaryName(currentBoundaries, 2),
    district: boundaryName(currentBoundaries, 1) || boundaryName(legacyBoundaries, 1),
    city: boundaryName(currentBoundaries, 0) || boundaryName(legacyBoundaries, 0),
    latitude: null,
    longitude: null
  };
}

export function mergeVietMapPlace(
  suggestion: AddressSuggestion,
  place: VietMapPlaceResult
): AddressSuggestion {
  const streetAddress = [place.hs_num?.trim(), place.street?.trim()].filter(Boolean).join(' ');
  const displayAddress = place.display?.trim();
  return {
    ...suggestion,
    title: place.name?.trim() || suggestion.title,
    formattedAddress: displayAddress || suggestion.formattedAddress,
    address: displayAddress || place.address?.trim() || streetAddress || suggestion.address,
    ward: normalizeAdminName(place.ward, 2) || suggestion.ward,
    district: normalizeAdminName(place.district, 1) || suggestion.district,
    city: normalizeAdminName(place.city, 0) || suggestion.city,
    latitude: typeof place.lat === 'number' ? place.lat : null,
    longitude: typeof place.lng === 'number' ? place.lng : null
  };
}

function boundaryName(boundaries: VietMapBoundary[], type: number): string {
  const boundary = boundaries.find(item => item.type === type);
  return normalizeAdminName(boundary?.name || boundary?.full_name, type);
}

function normalizeAdminName(value: string | undefined, type: number): string {
  const normalized = value?.trim() ?? '';
  if (type === 0) return normalized.replace(/^(?:Thành\s+phố|Tỉnh)\s+/iu, '').trim();
  if (type === 1) return normalized.replace(/^(?:Quận|Huyện|Thị\s+xã|Thành\s+phố)\s+/iu, '').trim();
  if (type === 2) return normalized.replace(/^(?:Phường|Xã|Thị\s+trấn)\s+/iu, '').trim();
  return normalized;
}
