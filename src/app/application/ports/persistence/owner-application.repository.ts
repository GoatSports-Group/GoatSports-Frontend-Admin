import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { OwnerApplication } from '@domain/entities/owner-application';
import { PageFilter } from '@application/dto/page.filter';
import { BaseListResponse } from '@application/dto/base/base-response';

export interface OwnerApplicationRepository {
  getAllApplications(filter: PageFilter): Observable<BaseListResponse<OwnerApplication>>;
  getMyApplications(filter?: PageFilter): Observable<BaseListResponse<OwnerApplication>>;
  getApplicationDetail(id: string): Observable<OwnerApplication>;
  markViewed(id: string): Observable<void>;
  approve(id: string): Observable<void>;
  reject(id: string, rejectReason: string): Observable<void>;
  getFileUrl(key: string): Observable<string>;
  analyzeFaceReadiness(frame: string): Observable<OwnerFaceReadiness>;
  verifyIdentity(files: OwnerApplicationFiles, livenessFrames: string[]): Observable<PreparedOwnerIdentity>;
  submit(form: Record<string, unknown>, preparedIdentity: PreparedOwnerIdentity): Observable<void>;
}

export interface OwnerFaceReadiness {
  ready: boolean;
  reasonCode: string;
  message: string;
  faceCount: number;
  brightness: number;
  centered: boolean;
  frontal: boolean;
  glassesFree: boolean;
  eyesOpen: boolean;
  maskFree: boolean;
  faceBox: [number, number, number, number] | null;
  yawRatio: number;
  pitchRatio: number;
  rollDegrees: number;
}

export interface OwnerApplicationFiles {
  idCardFront: File;
  idCardBack: File;
  businessLicense: File;
  venueImage: File;
}

export interface PreparedOwnerIdentity {
  ownerApplicationId: string;
  identityVerificationId: string;
  fullName: string;
  identityNumber: string;
  documents: Array<{
    slot: 'IDENTITY_FRONT' | 'IDENTITY_BACK' | 'BUSINESS_LICENSE' | 'VENUE_PHOTO';
    objectKey: string;
  }>;
}

export const OWNER_APPLICATION_REPOSITORY_TOKEN = new InjectionToken<OwnerApplicationRepository>('OwnerApplicationRepository');
