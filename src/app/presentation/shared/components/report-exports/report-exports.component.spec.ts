import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { provideLucideIcons } from '@lucide/angular';
import { APP_ICONS } from '../../../../app-icons';
import { REPORT_EXPORT_REPOSITORY_TOKEN, ReportExport } from '@application/ports/persistence/report-export.repository';
import { NotifyService } from '@shared/components/notify/notify.service';
import { ExportFormatOption, ReportExportsComponent } from './report-exports.component';

describe('ReportExportsComponent', () => {
  const job = (status: ReportExport['status'], extra: Partial<ReportExport> = {}): ReportExport => ({
    exportId: 'e-1', reportType: 'ADMIN_BOOKINGS', format: 'xlsx', status, filterSummary: 'Trạng thái đơn: Hoàn tất',
    rowCount: null, fileName: null, fileSize: null, failureReason: null, createdAt: '2026-10-12T04:00:00Z',
    completedAt: null, expiresAt: '2026-10-19T04:00:00Z', ...extra
  });
  const formats: ExportFormatOption[] = [
    { value: 'xlsx', label: 'Excel · danh sách', hint: 'Mỗi dòng một mục.', icon: 'file-spreadsheet' },
    { value: 'pdf', label: 'PDF · xem trước, in', hint: 'Bản in.', icon: 'file-text' }
  ];
  const repository = { list: vi.fn(), download: vi.fn() };
  const request = vi.fn();
  const notify = { info: vi.fn(), success: vi.fn(), error: vi.fn() };
  const params = new BehaviorSubject(convertToParamMap({}));

  beforeEach(async () => {
    vi.useFakeTimers();
    request.mockReset();
    repository.list.mockReset().mockReturnValue(of([]));
    repository.download.mockReset();
    Object.values(notify).forEach(fn => fn.mockReset());
    params.next(convertToParamMap({}));
    await TestBed.configureTestingModule({
      imports: [ReportExportsComponent],
      providers: [
        provideLucideIcons(...APP_ICONS),
        { provide: REPORT_EXPORT_REPOSITORY_TOKEN, useValue: repository },
        { provide: NotifyService, useValue: notify },
        { provide: ActivatedRoute, useValue: { queryParamMap: params } }
      ]
    }).compileComponents();
  });

  afterEach(() => vi.useRealTimers());

  function create(total = 1612, types = ['ADMIN_BOOKINGS']) {
    const fixture = TestBed.createComponent(ReportExportsComponent);
    fixture.componentRef.setInput('request', request);
    fixture.componentRef.setInput('types', types);
    fixture.componentRef.setInput('formats', formats);
    fixture.componentRef.setInput('total', total);
    fixture.componentRef.setInput('unit', 'đơn');
    fixture.componentRef.setInput('scope', ['Hoàn tất']);
    fixture.detectChanges();
    return fixture;
  }

  it('queues the export in the background, then polls until it is ready and says so', () => {
    request.mockReturnValue(of(job('PENDING')));
    const fixture = create();
    const component = fixture.componentInstance;

    component.openDialog();
    component.format.set('pdf');
    component.submit();

    expect(request).toHaveBeenCalledWith('pdf');
    expect(repository.list).toHaveBeenCalledWith(['ADMIN_BOOKINGS']);
    expect(component.dialogOpen()).toBe(false);
    expect(component.panelOpen()).toBe(true);
    expect(component.activeCount()).toBe(1);
    expect(notify.info).toHaveBeenCalled();

    repository.list.mockReturnValue(of([job('DONE', { rowCount: 1612, fileName: 'a.xlsx', fileSize: 250_000 })]));
    vi.advanceTimersByTime(3_000);

    expect(component.activeCount()).toBe(0);
    expect(notify.success).toHaveBeenCalledTimes(1);
    // Hết job đang chạy thì ngừng hỏi lại.
    vi.advanceTimersByTime(10_000);
    expect(repository.list).toHaveBeenCalledTimes(2);
  });

  it('opens a ready PDF in a new tab from the downloaded file', () => {
    const tab = { document: { title: '', body: { textContent: '' } }, location: { href: '' }, close: vi.fn() };
    const open = vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window);
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:pdf');
    globalThis.URL.revokeObjectURL = vi.fn();
    repository.download.mockReturnValue(of(new Blob(['%PDF'])));
    const component = create().componentInstance;

    component.preview(job('DONE', { format: 'pdf', fileName: 'tong-hop.pdf' }));

    expect(open).toHaveBeenCalledWith('', '_blank');
    expect(repository.download).toHaveBeenCalledWith('e-1');
    expect(tab.location.href).toBe('blob:pdf');
    open.mockRestore();
  });

  it('refuses exports over 10,000 rows before calling the server', () => {
    const fixture = create(12_000);
    fixture.componentInstance.openDialog();
    fixture.componentInstance.submit();

    expect(fixture.componentInstance.tooMany()).toBe(true);
    expect(request).not.toHaveBeenCalled();
  });

  it('names each report kind and counts its rows in its own unit when the list mixes kinds', () => {
    repository.list.mockReturnValue(of([
      job('DONE', { exportId: 'r', reportType: 'FINANCE_REFUNDS', rowCount: 12, fileSize: 2048 }),
      job('DONE', { exportId: 'p', reportType: 'FINANCE_PAYOUTS', format: 'pdf', rowCount: 3, fileSize: 4096 })
    ]));
    const fixture = create(5, ['FINANCE_REFUNDS', 'FINANCE_PAYOUTS']);
    fixture.componentRef.setInput('kinds', {
      FINANCE_REFUNDS: { label: 'Hoàn tiền', unit: 'khoản hoàn' }, FINANCE_PAYOUTS: { label: 'Chi trả', unit: 'lượt chi' }
    });
    fixture.componentInstance.openPanel();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(repository.list).toHaveBeenLastCalledWith(['FINANCE_REFUNDS', 'FINANCE_PAYOUTS']);
    expect(text).toContain('Hoàn tiền · Excel · danh sách');
    expect(text).toContain('12 khoản hoàn');
    expect(text).toContain('Chi trả · PDF · xem trước, in');
    expect(text).toContain('3 lượt chi');
  });

  it('opens the exports list when arriving from the notification link', () => {
    const fixture = create();
    params.next(convertToParamMap({ exports: 'open' }));
    fixture.detectChanges();

    expect(fixture.componentInstance.panelOpen()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Chưa có báo cáo nào');
  });
});
