import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import {
  ConfirmOwnerCheckIn,
  CreateWalkInBooking,
  OwnerCheckInFilter,
  OwnerCheckInLookup,
  OwnerCheckInPage,
  OwnerCheckInResult
} from '@application/dto/owner-check-in/owner-check-in.dto';
import { OwnerCheckInRepository } from '@application/ports/persistence/owner-check-in.repository';
import { OwnerCheckInApi } from '@infrastructure/api/owner-check-in.api';

@Injectable()
export class OwnerCheckInRepositoryImpl implements OwnerCheckInRepository {
  private readonly api = inject(OwnerCheckInApi);

  lookup(request: OwnerCheckInLookup): Observable<OwnerCheckInResult> {
    return this.api.lookup(request).pipe(map(response => response.data));
  }

  confirm(request: ConfirmOwnerCheckIn): Observable<OwnerCheckInResult> {
    return this.api.confirm(request).pipe(map(response => response.data));
  }

  createWalkIn(request: CreateWalkInBooking): Observable<OwnerCheckInResult> {
    return this.api.createWalkIn(request).pipe(map(response => response.data));
  }

  history(filter: OwnerCheckInFilter): Observable<OwnerCheckInPage> {
    return this.api.history(filter).pipe(map(response => ({
      items: response.data?.result ?? [],
      page: response.data?.meta.page ?? filter.page,
      pageSize: response.data?.meta.pageSize ?? filter.size,
      pages: response.data?.meta.pages ?? 0,
      total: response.data?.meta.total ?? 0
    })));
  }
}
