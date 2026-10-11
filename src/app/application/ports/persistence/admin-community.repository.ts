import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

export type SportType = 'FOOTBALL' | 'BADMINTON' | 'TENNIS' | 'BASKETBALL' | 'PICKLEBALL' | 'VOLLEYBALL';
export type ClubState = 'ACTIVE' | 'DISBANDED';
export type AdminTournamentStatus =
  'PUBLISHED' | 'REGISTRATION_OPEN' | 'REGISTRATION_CLOSED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface AdminClub {
  clubId: string;
  name: string;
  sportType: SportType;
  city: string | null;
  logoUrl: string | null;
  ownerId: string;
  privacy: 'PUBLIC' | 'PRIVATE';
  disbanded: boolean;
  disbandedAt: string | null;
  eloRating: number | null;
  matchCount: number | null;
  createdAt: string | null;
  memberCount: number;
}

export interface AdminTournament {
  tournamentId: string;
  name: string;
  sportType: SportType;
  format: 'SINGLE_ELIMINATION' | 'ROUND_ROBIN';
  /** Trạng thái hiển thị (mở/đóng đăng ký suy ra từ ngày). */
  status: AdminTournamentStatus;
  organizerId: string;
  venueId: string | null;
  maxParticipants: number | null;
  currentParticipants: number;
  entryFee: number | null;
  prizePool: number | null;
  registrationOpenDate: string | null;
  registrationCloseDate: string | null;
  startDate: string | null;
  endDate: string | null;
  createdAt: string | null;
}

export interface CommunityFilter<S> {
  state?: S;
  sportType?: SportType;
  keyword?: string;
  page: number;
  size: number;
}

export interface CommunityPage<T> {
  items: T[];
  total: number;
}

/** CLB và giải đấu toàn sàn (club-service, phía admin, chỉ xem). */
export interface AdminCommunityRepository {
  getClubs(filter: CommunityFilter<ClubState>): Observable<CommunityPage<AdminClub>>;
  getTournaments(filter: CommunityFilter<AdminTournamentStatus>): Observable<CommunityPage<AdminTournament>>;
}

export const ADMIN_COMMUNITY_REPOSITORY_TOKEN = new InjectionToken<AdminCommunityRepository>('ADMIN_COMMUNITY_REPOSITORY_TOKEN');
