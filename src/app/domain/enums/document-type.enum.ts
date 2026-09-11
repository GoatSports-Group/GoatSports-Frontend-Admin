export enum DocumentType {
  IDENTITY_CARD = 'IDENTITY_CARD',
  BUSINESS_LICENSE = 'BUSINESS_LICENSE',
  VENUE_PHOTO = 'VENUE_PHOTO',
}

export const DOCUMENT_TYPE_OPTIONS = [
  {
    value: DocumentType.IDENTITY_CARD,
    label: 'CCCD',
  },
  {
    value: DocumentType.BUSINESS_LICENSE,
    label: 'Giấy phép kinh doanh',
  },
  {
    value: DocumentType.VENUE_PHOTO,
    label: 'Ảnh sân',
  },
];
