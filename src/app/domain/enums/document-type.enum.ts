export enum DocumentType {
  ID_CARD = 'ID_CARD',
  BUSINESS_LICENSE = 'BUSINESS_LICENSE',
  VENUE_IMAGE = 'VENUE_IMAGE',
}

export const DOCUMENT_TYPE_OPTIONS = [
  {
    value: DocumentType.ID_CARD,
    label: 'CCCD',
  },
  {
    value: DocumentType.BUSINESS_LICENSE,
    label: 'Giấy phép kinh doanh',
  },
  {
    value: DocumentType.VENUE_IMAGE,
    label: 'Ảnh sân',
  },
];
