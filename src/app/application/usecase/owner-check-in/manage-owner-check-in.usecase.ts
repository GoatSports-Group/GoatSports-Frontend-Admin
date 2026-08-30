import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  ConfirmOwnerCheckIn,
  CreateWalkInBooking,
  OwnerCheckInFilter,
  OwnerCheckInLookup,
  OwnerCheckInPage,
  OwnerCheckInResult
} from '@application/dto/owner-check-in/owner-check-in.dto';
import {
  OWNER_CHECK_IN_REPOSITORY_TOKEN,
  OwnerCheckInRepository
} from '@application/ports/persistence/owner-check-in.repository';

@Injectable({ providedIn: 'root' })
export class ManageOwnerCheckInUseCase {
  constructor(
    @Inject(OWNER_CHECK_IN_REPOSITORY_TOKEN) private readonly repository: OwnerCheckInRepository
  ) { }

  lookup(request: OwnerCheckInLookup): Observable<OwnerCheckInResult> {
    return this.repository.lookup(request);
  }

  confirm(request: ConfirmOwnerCheckIn): Observable<OwnerCheckInResult> {
    return this.repository.confirm(request);
  }

  createWalkIn(request: CreateWalkInBooking): Observable<OwnerCheckInResult> {
    return this.repository.createWalkIn(request);
  }

  history(filter: OwnerCheckInFilter): Observable<OwnerCheckInPage> {
    return this.repository.history(filter);
  }
}
