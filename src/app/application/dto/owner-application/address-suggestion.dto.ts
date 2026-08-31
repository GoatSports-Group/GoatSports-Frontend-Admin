export interface AddressSuggestion {
  id: string;
  refId: string;
  title: string;
  formattedAddress: string;
  address: string;
  ward: string;
  district: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
}
