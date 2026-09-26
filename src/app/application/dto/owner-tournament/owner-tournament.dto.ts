export type TournamentSport = 'FOOTBALL' | 'BADMINTON' | 'TENNIS' | 'PICKLEBALL' | 'BASKETBALL' | 'VOLLEYBALL';
export type TournamentFormat = 'SINGLE_ELIMINATION' | 'ROUND_ROBIN';
export type TournamentStatus =
  | 'DRAFT' | 'PUBLISHED' | 'REGISTRATION_OPEN' | 'REGISTRATION_CLOSED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type ParticipantType = 'INDIVIDUAL' | 'TEAM';
export type RegistrationStatus =
  | 'PENDING_MEMBERS' | 'PENDING_ELIGIBILITY' | 'PENDING_PAYMENT' | 'CONFIRMED' | 'REJECTED' | 'CANCELLED';
export type FeePaymentStatus = 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'WAIVED' | 'REFUND_REQUESTED';
export type LineupMemberStatus = 'INVITED' | 'ACCEPTED' | 'DECLINED';
export type EligibilityRuleType = 'AGE' | 'GENDER' | 'SKILL_LEVEL' | 'ELO_RATING' | 'CLUB_MEMBERSHIP' | 'TEAM_SIZE';
export type EligibilityRuleOperator =
  | 'EQUAL' | 'NOT_EQUAL' | 'GREATER_THAN' | 'GREATER_THAN_OR_EQUAL' | 'LESS_THAN' | 'LESS_THAN_OR_EQUAL' | 'IN' | 'BETWEEN';

/** Hinh thuc thi dau do club-service quy dinh theo mon (don/doi, so nguoi). */
export interface PlayFormat {
  code: string;
  label: string;
  sport: TournamentSport;
  participantType: ParticipantType;
  onField: number;
  rosterMin: number;
  rosterMax: number;
}

export interface OwnerTournament {
  tournamentId: string;
  organizerId: string;
  name: string;
  description?: string;
  sportType: TournamentSport;
  format: TournamentFormat;
  status: TournamentStatus;
  maxParticipants: number;
  currentParticipants: number;
  entryFee: number;
  prizePool: number;
  registrationOpenDate: string;
  registrationCloseDate: string;
  startDate: string;
  endDate: string;
  rules: string[];
  venueId?: string;
  courtIds?: string[];
  dailyStartTime?: string;
  dailyEndTime?: string;
  matchDurationMinutes?: number;
  playFormat: string;
  playFormatLabel: string;
  participantType: ParticipantType;
  rosterMin: number;
  rosterMax: number;
  /** Chỉ có khi giải đã kết thúc. */
  championRegistrationId?: string | null;
  championName?: string | null;
  completedAt?: string | null;
}

export interface EligibilityRule {
  ruleId?: string;
  ruleType: EligibilityRuleType;
  operator: EligibilityRuleOperator;
  expectedValue: string;
}

export interface TournamentUpsert {
  name: string;
  description?: string;
  sportType: TournamentSport;
  format: TournamentFormat;
  maxParticipants: number;
  entryFee: number;
  prizePool: number;
  registrationOpenDate: string;
  registrationCloseDate: string;
  startDate: string;
  endDate: string;
  rules: string[];
  eligibilityRules: EligibilityRule[];
  venueId: string;
  courtIds: string[];
  dailyStartTime: string;
  dailyEndTime: string;
  matchDurationMinutes: number;
  playFormat: string;
  publish?: boolean;
}

export interface TournamentLineup {
  lineupId: string;
  playerId: string;
  playerName?: string;
  lineupRole: 'CAPTAIN' | 'PLAYER' | 'SUBSTITUTE';
  shirtNumber?: number;
  memberStatus: LineupMemberStatus;
}

export interface TournamentRegistration {
  registrationId: string;
  tournamentId: string;
  type: 'INDIVIDUAL' | 'TEAM' | 'CLUB';
  playerId?: string;
  clubId?: string;
  teamName?: string;
  registeredBy: string;
  status: RegistrationStatus;
  statusReason?: string;
  registeredAt?: string;
  confirmedAt?: string;
  paymentDeadline?: string;
  paymentStatus?: FeePaymentStatus;
  feeAmount?: number;
  lineups: TournamentLineup[];
}

export interface TournamentFixture {
  fixtureId: string;
  roundName: string;
  roundNumber: number;
  matchNumber: number;
  registration1Id?: string;
  registration2Id?: string;
  score1?: number;
  score2?: number;
  winnerRegistrationId?: string;
  reservationId?: string;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
}

export interface TournamentStanding {
  registrationId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  scoreFor: number;
  scoreAgainst: number;
  points: number;
  rank: number;
}

export interface MatchSchedule {
  reservationId: string;
  courtId: string;
  playDate: string;
  startTime: string;
  endTime: string;
  status: 'PENDING' | 'CONFIRMED' | 'RELEASED' | 'CANCELLED';
}

export interface ScheduleMatchRequest {
  courtId: string;
  fixtureId?: string | null;
  playDate: string;
  startTime: string;
  endTime: string;
}

export interface OwnerTournamentPage {
  items: OwnerTournament[];
  total: number;
  totalPages: number;
}

/** Doanh thu giải đấu của chủ sân (club-service /tournaments/revenue/me). */
export interface TournamentRevenueEntry {
  date: string;
  tournamentId: string;
  tournamentName: string;
  venueId?: string | null;
  /** FEE: lệ phí thu (cộng) · PRIZE: giải thưởng trả khi kết thúc (trừ). */
  kind: 'FEE' | 'PRIZE';
  amount: number;
  count: number;
}

export interface OwnerTournamentRevenue {
  feeIncome: number;
  prizeExpense: number;
  net: number;
  paidRegistrations: number;
  entries: TournamentRevenueEntry[];
}

/** Bộ lọc danh sách giải của chủ sân (club-service /tournaments/me?role=ORGANIZING). */
export interface OwnerTournamentFilter {
  status?: TournamentStatus;
  sportType?: TournamentSport;
  venueId?: string;
  keyword?: string;
}

/** Số giải theo trạng thái trên toàn bộ giải của chủ sân (không phụ thuộc trang đang xem). */
export interface OwnerTournamentSummary {
  byStatus: Partial<Record<TournamentStatus, number>>;
  total: number;
  seatsHeld: number;
}
