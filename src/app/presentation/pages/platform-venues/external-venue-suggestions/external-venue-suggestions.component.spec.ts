import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { provideLucideIcons } from '@lucide/angular';
import { APP_ICONS } from '../../../../app-icons';
import {
  ADMIN_VENUE_REPOSITORY_TOKEN, ExternalVenueSuggestion
} from '@application/ports/persistence/admin-venue.repository';
import { ExternalVenueSuggestionsComponent } from './external-venue-suggestions.component';

describe('ExternalVenueSuggestionsComponent', () => {
  const suggestion = (id: string, nearby: ExternalVenueSuggestion['nearby'] = []): ExternalVenueSuggestion => ({
    suggestionId: id, suggestedBy: 'player-1', name: `Sân ${id}`, sportTypes: ['BADMINTON'], latitude: 10.8,
    longitude: 106.7, address: null, phone: '0909 000 000', note: 'Sân trong nhà', createdAt: '2026-10-23T09:00:00',
    nearby
  });
  const repository = {
    getExternalVenueSuggestions: vi.fn(), approveExternalVenueSuggestion: vi.fn(), rejectExternalVenueSuggestion: vi.fn()
  };

  function create() {
    TestBed.configureTestingModule({
      imports: [ExternalVenueSuggestionsComponent],
      providers: [provideLucideIcons(...APP_ICONS), { provide: ADMIN_VENUE_REPOSITORY_TOKEN, useValue: repository }]
    });
    const fixture = TestBed.createComponent(ExternalVenueSuggestionsComponent);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => vi.clearAllMocks());

  it('warns about a nearby venue and drops a suggestion once it is approved', () => {
    repository.getExternalVenueSuggestions.mockReturnValue(of({
      items: [suggestion('a', [{ name: 'Sân Thi Sách', distanceMeters: 40, partner: false }]), suggestion('b')],
      total: 2, pages: 1
    }));
    repository.approveExternalVenueSuggestion.mockReturnValue(of({}));
    const fixture = create();
    const page = fixture.componentInstance;
    const pending: number[] = [];
    page.pendingChange.subscribe(count => pending.push(count));
    expect(fixture.nativeElement.textContent).toContain('Có thể trùng');
    expect(fixture.nativeElement.textContent).toContain('Sân Thi Sách');

    page.approve(page.items()[0]);

    expect(repository.approveExternalVenueSuggestion).toHaveBeenCalledWith('a');
    expect(page.items().map(item => item.suggestionId)).toEqual(['b']);
    expect(pending).toEqual([1]);
  });

  it('rejects with the trimmed reason, or none when left empty', () => {
    repository.getExternalVenueSuggestions.mockReturnValue(of({ items: [suggestion('a'), suggestion('b')], total: 2, pages: 1 }));
    repository.rejectExternalVenueSuggestion.mockReturnValue(of(undefined));
    const page = create().componentInstance;

    page.openReject(page.items()[0]);
    page.rejectReason.set('  Trùng sân đã có  ');
    page.confirmReject();
    page.openReject(page.items()[0]);
    page.confirmReject();

    expect(repository.rejectExternalVenueSuggestion).toHaveBeenNthCalledWith(1, 'a', 'Trùng sân đã có');
    expect(repository.rejectExternalVenueSuggestion).toHaveBeenNthCalledWith(2, 'b', null);
    expect(page.rejecting()).toBeNull();
  });
});
