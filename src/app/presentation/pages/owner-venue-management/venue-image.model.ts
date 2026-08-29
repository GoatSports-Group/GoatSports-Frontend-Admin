export interface VenueImageItem {
  id: string;
  key: string | null;
  displayUrl: string | null;
  fileName: string;
  uploading: boolean;
  resolving: boolean;
  localPreview: boolean;
}
