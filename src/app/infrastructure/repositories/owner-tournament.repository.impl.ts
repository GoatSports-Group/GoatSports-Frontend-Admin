import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { BaseResponse } from '@application/dto/base/base-response';
import {
  EligibilityRule, MatchSchedule, OwnerTournament, OwnerTournamentPage, OwnerTournamentRevenue, PlayFormat, ScheduleMatchRequest,
  TournamentFixture, TournamentRegistration, TournamentSport, TournamentStanding, TournamentStatus, TournamentUpsert
} from '@application/dto/owner-tournament/owner-tournament.dto';
import { OwnerTournamentRepository } from '@application/ports/persistence/owner-tournament.repository';
import { environment } from '@environments/environment';

interface PagedModel<T> { content: T[]; page: { totalElements: number; totalPages: number } }

@Injectable({ providedIn: 'root' })
export class OwnerTournamentRepositoryImpl implements OwnerTournamentRepository {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/club-service/api/v1/tournaments`;

  /** club-service phan trang 0-based. */
  getMine(page: number, size: number): Observable<OwnerTournamentPage> {
    const params = new HttpParams().set('role', 'ORGANIZING').set('page', page).set('size', size)
      .set('sort', 'startDate,desc');
    return this.http.get<BaseResponse<PagedModel<OwnerTournament>>>(`${this.baseUrl}/me`, { params }).pipe(map(response => ({
      items: response.data?.content ?? [],
      total: response.data?.page?.totalElements ?? 0,
      totalPages: response.data?.page?.totalPages ?? 0
    })));
  }
  getRevenue(fromDate: string, toDate: string, venueId?: string): Observable<OwnerTournamentRevenue> {
    let params = new HttpParams().set('fromDate', fromDate).set('toDate', toDate);
    if (venueId) params = params.set('venueId', venueId);
    return this.http.get<BaseResponse<OwnerTournamentRevenue>>(`${this.baseUrl}/revenue/me`, { params })
      .pipe(map(response => response.data ?? { feeIncome: 0, prizeExpense: 0, net: 0, paidRegistrations: 0, entries: [] }));
  }
  get(tournamentId: string) { return this.data<OwnerTournament>(this.http.get(`${this.baseUrl}/${tournamentId}`)); }
  getPlayFormats(sport: TournamentSport) {
    return this.list<PlayFormat>(this.http.get(`${this.baseUrl}/play-formats`, { params: { sportType: sport } }));
  }
  create(request: TournamentUpsert) { return this.data<OwnerTournament>(this.http.post(this.baseUrl, request)); }
  update(tournamentId: string, request: TournamentUpsert) {
    return this.data<OwnerTournament>(this.http.put(`${this.baseUrl}/${tournamentId}`, request));
  }
  changeStatus(tournamentId: string, status: TournamentStatus) {
    return this.data<OwnerTournament>(this.http.patch(`${this.baseUrl}/${tournamentId}/status`, { status }));
  }
  getRules(tournamentId: string) { return this.list<EligibilityRule>(this.http.get(`${this.baseUrl}/${tournamentId}/eligibility-rules`)); }
  getRegistrations(tournamentId: string) {
    return this.list<TournamentRegistration>(this.http.get(`${this.baseUrl}/${tournamentId}/teams`));
  }
  reject(tournamentId: string, registrationId: string, reason: string): Observable<void> {
    return this.http.delete(`${this.baseUrl}/${tournamentId}/registrations/${registrationId}`,
      { params: reason.trim() ? { reason: reason.trim() } : {} }).pipe(map(() => void 0));
  }
  getFixtures(tournamentId: string) { return this.list<TournamentFixture>(this.http.get(`${this.baseUrl}/${tournamentId}/fixtures`)); }
  generateFixtures(tournamentId: string) {
    return this.list<TournamentFixture>(this.http.post(`${this.baseUrl}/${tournamentId}/generate-fixtures`, {}));
  }
  updateScore(tournamentId: string, fixtureId: string, score1: number, score2: number) {
    return this.data<TournamentFixture>(this.http.put(`${this.baseUrl}/${tournamentId}/fixtures/${fixtureId}/result`,
      { score1, score2 }));
  }
  getStandings(tournamentId: string) { return this.list<TournamentStanding>(this.http.get(`${this.baseUrl}/${tournamentId}/standings`)); }
  getSchedules(tournamentId: string) { return this.list<MatchSchedule>(this.http.get(`${this.baseUrl}/${tournamentId}/reservations`)); }
  scheduleMatch(tournamentId: string, request: ScheduleMatchRequest) {
    return this.data<MatchSchedule>(this.http.post(`${this.baseUrl}/${tournamentId}/reservations`, request));
  }
  releaseSchedule(tournamentId: string, reservationId: string): Observable<void> {
    return this.http.delete(`${this.baseUrl}/${tournamentId}/reservations/${reservationId}`).pipe(map(() => void 0));
  }

  private data<T>(request: Observable<unknown>): Observable<T> {
    return request.pipe(map(response => (response as BaseResponse<T>).data));
  }

  private list<T>(request: Observable<unknown>): Observable<T[]> {
    return request.pipe(map(response => (response as BaseResponse<T[]>).data ?? []));
  }
}
