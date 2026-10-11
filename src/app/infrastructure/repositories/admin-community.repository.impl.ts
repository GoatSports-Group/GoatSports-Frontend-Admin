import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { BaseResponse } from '@application/dto/base/base-response';
import {
  AdminClub, AdminCommunityRepository, AdminTournament, AdminTournamentStatus, ClubState, CommunityFilter, CommunityPage
} from '@application/ports/persistence/admin-community.repository';
import { environment } from '@environments/environment';

/** club-service trả Page dạng VIA_DTO: { content, page: { totalElements } }. */
interface PagedModel<T> { content: T[]; page: { totalElements: number } }

@Injectable({ providedIn: 'root' })
export class AdminCommunityRepositoryImpl implements AdminCommunityRepository {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/club-service/api/v1/admin`;

  getClubs(filter: CommunityFilter<ClubState>): Observable<CommunityPage<AdminClub>> {
    return this.page<AdminClub>('clubs', this.params(filter, 'state'));
  }

  getTournaments(filter: CommunityFilter<AdminTournamentStatus>): Observable<CommunityPage<AdminTournament>> {
    return this.page<AdminTournament>('tournaments', this.params(filter, 'status'));
  }

  private params(filter: CommunityFilter<string>, stateParam: 'state' | 'status'): HttpParams {
    let params = new HttpParams().set('page', filter.page).set('size', filter.size);
    if (filter.state) params = params.set(stateParam, filter.state);
    if (filter.sportType) params = params.set('sportType', filter.sportType);
    if (filter.keyword) params = params.set('keyword', filter.keyword);
    return params;
  }

  private page<T>(path: string, params: HttpParams): Observable<CommunityPage<T>> {
    return this.http.get<BaseResponse<PagedModel<T>>>(`${this.baseUrl}/${path}`, { params })
      .pipe(map(response => ({ items: response.data?.content ?? [], total: response.data?.page?.totalElements ?? 0 })));
  }
}
