import {
  BUSINESS_TYPE_OPTIONS,
  BusinessType,
  DOCUMENT_TYPE_OPTIONS,
  DocumentType,
  OwnerApplication,
  OwnerApplicationDocument,
  OWNER_APPLICATION_STATUS_OPTIONS,
  OwnerApplicationStatus
} from '@application/dto/owner-application/owner-application.dto';
import { buildRsqlSearch } from '@shared/utils/api.helper';

export function buildOwnerApplicationFilter(status: string, search: string): string {
  const parts: string[] = [];

  if (status && status !== 'ALL') {
    parts.push(`status : '${status}'`);
  }

  const searchPart = buildRsqlSearch(search, ['fullName', 'email', 'phone']);
  if (searchPart) parts.push(`(${searchPart})`);
  return parts.join(' and ');
}

export function sortOwnerApplications(applications: OwnerApplication[]): OwnerApplication[] {
  return [...applications].sort((left, right) => {
    const leftPending = left.status === OwnerApplicationStatus.PENDING;
    const rightPending = right.status === OwnerApplicationStatus.PENDING;
    return leftPending === rightPending ? 0 : leftPending ? -1 : 1;
  });
}

export function getOwnerApplicationStatusLabel(status: OwnerApplicationStatus): string {
  return OWNER_APPLICATION_STATUS_OPTIONS.find(option => option.value === status)?.label || status;
}

export function getBusinessTypeLabel(type: BusinessType): string {
  return BUSINESS_TYPE_OPTIONS.find(option => option.value === type)?.label || type;
}

export function getDocumentTypeLabel(type: DocumentType): string {
  return DOCUMENT_TYPE_OPTIONS.find(option => option.value === type)?.label || type;
}

export function isIdCardDocument(document: OwnerApplicationDocument): boolean {
  return ['ID_CARD', 'ID_CARD_FRONT', 'ID_CARD_BACK'].includes(document.documentType as string);
}

export function getIdCardDocuments(documents: OwnerApplicationDocument[] = []): OwnerApplicationDocument[] {
  return documents.filter(isIdCardDocument);
}

export function getNonIdCardDocuments(documents: OwnerApplicationDocument[] = []): OwnerApplicationDocument[] {
  return documents.filter(document => !isIdCardDocument(document));
}
