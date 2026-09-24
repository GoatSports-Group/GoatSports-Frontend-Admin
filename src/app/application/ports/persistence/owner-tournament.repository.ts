import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import {
  EligibilityRule, MatchSchedule, OwnerTournament, OwnerTournamentPage, PlayFormat, ScheduleMatchRequest,
  TournamentFixture, TournamentRegistration, TournamentSport, TournamentStanding, TournamentStatus, TournamentUpsert
} from '@application/dto/owner-tournament/owner-tournament.dto';

/** Giai do chu san to chuc (club-service /api/v1/tournaments). */
export interface OwnerTournamentRepository {
  getMine(page: number, size: number): Observable<OwnerTournamentPage>;
  get(tournamentId: string): Observable<OwnerTournament>;
  getPlayFormats(sport: TournamentSport): Observable<PlayFormat[]>;
  create(request: TournamentUpsert): Observable<OwnerTournament>;
  update(tournamentId: string, request: TournamentUpsert): Observable<OwnerTournament>;
  changeStatus(tournamentId: string, status: TournamentStatus): Observable<OwnerTournament>;
  getRules(tournamentId: string): Observable<EligibilityRule[]>;
  getRegistrations(tournamentId: string): Observable<TournamentRegistration[]>;
  reject(tournamentId: string, registrationId: string, reason: string): Observable<void>;
  getFixtures(tournamentId: string): Observable<TournamentFixture[]>;
  generateFixtures(tournamentId: string): Observable<TournamentFixture[]>;
  updateScore(tournamentId: string, fixtureId: string, score1: number, score2: number): Observable<TournamentFixture>;
  getStandings(tournamentId: string): Observable<TournamentStanding[]>;
  getSchedules(tournamentId: string): Observable<MatchSchedule[]>;
  scheduleMatch(tournamentId: string, request: ScheduleMatchRequest): Observable<MatchSchedule>;
  releaseSchedule(tournamentId: string, reservationId: string): Observable<void>;
}

export const OWNER_TOURNAMENT_REPOSITORY_TOKEN =
  new InjectionToken<OwnerTournamentRepository>('OwnerTournamentRepository');
