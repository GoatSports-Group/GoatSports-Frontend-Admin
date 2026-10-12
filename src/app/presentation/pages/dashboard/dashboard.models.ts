import { OwnerApplicationStatus } from '@application/dto/owner-application/owner-application.dto';

export interface VenueMapMarker {
  lat: number;
  lng: number;
  businessName: string;
  fullName: string;
  addressText: string;
  status: OwnerApplicationStatus;
  district: string;
  isFallback: boolean;
}

export interface ApplicationPlace {
  businessName: string;
  fullName: string;
  status: OwnerApplicationStatus;
}

export interface DistrictGroup {
  name: string;
  applications: ApplicationPlace[];
}

/** Hồ sơ chủ sân gom theo tỉnh / thành, mỗi tỉnh gom tiếp theo quận / huyện. */
export interface ProvinceBreakdownItem {
  name: string;
  count: number;
  districts: DistrictGroup[];
}
