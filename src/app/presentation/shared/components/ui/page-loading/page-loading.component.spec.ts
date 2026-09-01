import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { PageLoadingComponent } from './page-loading.component';

describe('PageLoadingComponent', () => {
  it('hiển thị nội dung mặc định với trạng thái truy cập được', async () => {
    await TestBed.configureTestingModule({ imports: [PageLoadingComponent] }).compileComponents();
    const fixture = TestBed.createComponent(PageLoadingComponent);
    fixture.detectChanges();

    const loading = fixture.nativeElement.querySelector('.page-loading') as HTMLElement;
    expect(loading.getAttribute('role')).toBe('status');
    expect(loading.getAttribute('aria-live')).toBe('polite');
    expect(loading.textContent).toContain('Đang tải dữ liệu');
    expect(loading.textContent).toContain('Vui lòng chờ trong giây lát.');
  });

  it('nhận tiêu đề, mô tả và kích thước tùy chỉnh', async () => {
    await TestBed.configureTestingModule({ imports: [PageLoadingComponent] }).compileComponents();
    const fixture = TestBed.createComponent(PageLoadingComponent);
    fixture.componentRef.setInput('title', 'Đang tải lịch sân');
    fixture.componentRef.setInput('description', 'Đang đồng bộ khung giờ mới nhất.');
    fixture.componentRef.setInput('size', 'compact');
    fixture.detectChanges();

    const loading = fixture.nativeElement.querySelector('.page-loading') as HTMLElement;
    expect(loading.dataset['size']).toBe('compact');
    expect(loading.getAttribute('aria-label')).toBe('Đang tải lịch sân');
    expect(loading.textContent).toContain('Đang đồng bộ khung giờ mới nhất.');
  });
});
