import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { LoadingSkeletonComponent } from './loading-skeleton.component';

describe('LoadingSkeletonComponent', () => {
  async function create(inputs: Record<string, unknown>) {
    await TestBed.configureTestingModule({ imports: [LoadingSkeletonComponent] }).compileComponents();
    const fixture = TestBed.createComponent(LoadingSkeletonComponent);
    Object.entries(inputs).forEach(([key, value]) => fixture.componentRef.setInput(key, value));
    fixture.detectChanges();
    return fixture;
  }

  it('dựng bảng với cột đầu rộng hơn và đủ số dòng', async () => {
    const fixture = await create({ variant: 'table', count: 3, columns: 5 });
    const rows = fixture.nativeElement.querySelectorAll('.sk-table__row') as NodeListOf<HTMLElement>;

    expect(fixture.componentInstance.tableColumns).toBe('minmax(0, 1.6fr) repeat(4, minmax(0, 1fr))');
    expect(rows.length).toBe(4); // header + 3
    expect(rows[1].children.length).toBe(5);
  });

  it('ẩn hàng tiêu đề khi head = false', async () => {
    const fixture = await create({ variant: 'table', count: 2, head: false });
    expect(fixture.nativeElement.querySelectorAll('.sk-table__row').length).toBe(2);
  });

  it('thông báo trạng thái tải, trừ khi chỉ trang trí', async () => {
    const announced = await create({ variant: 'rows', label: 'Đang tải thông báo' });
    const root = announced.nativeElement.querySelector('.sk') as HTMLElement;
    expect(root.getAttribute('role')).toBe('status');
    expect(root.getAttribute('aria-label')).toBe('Đang tải thông báo');

    TestBed.resetTestingModule();
    const decorative = await create({ variant: 'rows', decorative: true });
    const quiet = decorative.nativeElement.querySelector('.sk') as HTMLElement;
    expect(quiet.getAttribute('role')).toBeNull();
    expect(quiet.getAttribute('aria-hidden')).toBe('true');
  });
});
