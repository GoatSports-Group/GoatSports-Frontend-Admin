import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { provideLucideIcons } from '@lucide/angular';
import { APP_ICONS } from '../../../../app-icons';
import { ADMIN_BOOKING_REPOSITORY_TOKEN, ReportExport } from '@application/ports/persistence/admin-booking.repository';
import { NotifyService } from '@shared/components/notify/notify.service';
import { BookingExportsComponent } from './booking-exports.component';

describe('BookingExportsComponent', () => {
  const job = (status: ReportExport['status'], extra: Partial<ReportExport> = {}): ReportExport => ({
    exportId: 'e-1', reportType: 'ADMIN_BOOKINGS', format: 'xlsx', status, filterSummary: 'Trạng thái đơn: Hoàn tất',
    rowCount: null, fileName: null, fileSize: null, failureReason: null, createdAt: '2026-10-12T04:00:00Z',
    completedAt: null, expiresAt: '2026-10-19T04:00:00Z', ...extra
  });
  const repository = { requestExport: vi.fn(), listExports: vi.fn(), downloadExport: vi.fn() };
  const notify = { info: vi.fn(), success: vi.fn(), error: vi.fn() };
  const params = new BehaviorSubject(convertToParamMap({}));

  beforeEach(async () => {
    vi.useFakeTimers();
    repository.requestExport.mockReset();
    repository.listExports.mockReset().mockReturnValue(of([]));
    Object.values(notify).forEach(fn => fn.mockReset());
    params.next(convertToParamMap({}));
    await TestBed.configureTestingModule({
      imports: [BookingExportsComponent],
      providers: [
        provideLucideIcons(...APP_ICONS),
        { provide: ADMIN_BOOKING_REPOSITORY_TOKEN, useValue: repository },
        { provide: NotifyService, useValue: notify },
        { provide: ActivatedRoute, useValue: { queryParamMap: params } }
      ]
    }).compileComponents();
  });

  afterEach(() => vi.useRealTimers());

  function create(total = 1612) {
    const fixture = TestBed.createComponent(BookingExportsComponent);
    fixture.componentRef.setInput('criteria', { status: 'COMPLETED' });
    fixture.componentRef.setInput('total', total);
    fixture.componentRef.setInput('scope', ['Hoàn tất']);
    fixture.detectChanges();
    return fixture;
  }

  it('queues the export in the background, then polls until it is ready and says so', () => {
    repository.requestExport.mockReturnValue(of(job('PENDING')));
    const fixture = create();
    const component = fixture.componentInstance;

    component.openDialog();
    component.format.set('pdf');
    component.submit();

    expect(repository.requestExport).toHaveBeenCalledWith({ status: 'COMPLETED' }, 'pdf', {});
    expect(component.dialogOpen()).toBe(false);
    expect(component.panelOpen()).toBe(true);
    expect(component.activeCount()).toBe(1);
    expect(notify.info).toHaveBeenCalled();

    repository.listExports.mockReturnValue(of([job('DONE', { rowCount: 1612, fileName: 'a.xlsx', fileSize: 250_000 })]));
    vi.advanceTimersByTime(3_000);

    expect(component.activeCount()).toBe(0);
    expect(notify.success).toHaveBeenCalledTimes(1);
    // Hết job đang chạy thì ngừng hỏi lại.
    vi.advanceTimersByTime(10_000);
    expect(repository.listExports).toHaveBeenCalledTimes(2);
  });

  it('opens a ready PDF in a new tab from the downloaded file', () => {
    const tab = { document: { title: '', body: { textContent: '' } }, location: { href: '' }, close: vi.fn() };
    const open = vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window);
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:pdf');
    globalThis.URL.revokeObjectURL = vi.fn();
    repository.downloadExport = vi.fn(() => of(new Blob(['%PDF'])));
    const component = create().componentInstance;

    component.preview(job('DONE', { format: 'pdf', fileName: 'tong-hop.pdf' }));

    expect(open).toHaveBeenCalledWith('', '_blank');
    expect(repository.downloadExport).toHaveBeenCalledWith('e-1');
    expect(tab.location.href).toBe('blob:pdf');
    open.mockRestore();
  });

  it('refuses exports over 10,000 bookings before calling the server', () => {
    const fixture = create(12_000);
    fixture.componentInstance.openDialog();
    fixture.componentInstance.submit();

    expect(fixture.componentInstance.tooMany()).toBe(true);
    expect(repository.requestExport).not.toHaveBeenCalled();
  });

  it('opens the exports list when arriving from the notification link', () => {
    const fixture = create();
    params.next(convertToParamMap({ exports: 'open' }));
    fixture.detectChanges();

    expect(fixture.componentInstance.panelOpen()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Chưa có báo cáo nào');
  });
});
