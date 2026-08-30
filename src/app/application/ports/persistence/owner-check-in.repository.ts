import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import {
  ConfirmOwnerCheckIn,
  CreateWalkInBooking,
  OwnerCheckInFilter,
  OwnerCheckInLookup,
  OwnerCheckInPage,
  OwnerCheckInResult
} from '@application/dto/owner-check-in/owner-check-in.dto';

export interface OwnerCheckInRepository {
  lookup(request: OwnerCheckInLookup): Observable<OwnerCheckInResult>;
  confirm(request: ConfirmOwnerCheckIn): Observable<OwnerCheckInResult>;
  createWalkIn(request: CreateWalkInBooking): Observable<OwnerCheckInResult>;
  history(filter: OwnerCheckInFilter): Observable<OwnerCheckInPage>;
}

export const OWNER_CHECK_IN_REPOSITORY_TOKEN =
  new InjectionToken<OwnerCheckInRepository>('OWNER_CHECK_IN_REPOSITORY_TOKEN');
