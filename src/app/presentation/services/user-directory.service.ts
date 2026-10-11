import { Injectable, inject, signal } from '@angular/core';
import { USER_REPOSITORY_TOKEN, UserSummary } from '@application/ports/persistence/user.repository';

const BATCH = 100;

/**
 * Tên người dùng cho các trang admin chỉ có mã (tài chính, CLB, giải đấu): mỗi trang dữ liệu gọi một lần
 * với cả lô mã (tối đa 100/lần), nhớ lại để đổi trang/đổi tab không hỏi lại.
 */
@Injectable({ providedIn: 'root' })
export class UserDirectoryService {
  private readonly repository = inject(USER_REPOSITORY_TOKEN);
  private readonly known = signal<ReadonlyMap<string, UserSummary | null>>(new Map());
  private readonly pending = new Set<string>();

  resolve(ids: readonly (string | null | undefined)[]): void {
    const missing = [...new Set(ids.filter((id): id is string => !!id))]
      .filter(id => !this.known().has(id) && !this.pending.has(id));
    for (let start = 0; start < missing.length; start += BATCH) {
      const batch = missing.slice(start, start + BATCH);
      batch.forEach(id => this.pending.add(id));
      this.repository.getSummaries(batch).subscribe({
        next: summaries => {
          const found = new Map(summaries.map(summary => [summary.userId, summary]));
          this.known.update(current => {
            const next = new Map(current);
            // Mã không còn tài khoản cũng được ghi nhớ (null) để không hỏi lại mãi.
            batch.forEach(id => next.set(id, found.get(id) ?? null));
            return next;
          });
          batch.forEach(id => this.pending.delete(id));
        },
        error: () => batch.forEach(id => this.pending.delete(id))
      });
    }
  }

  /** Tên hiển thị; chưa tải xong thì chuỗi rỗng, không tồn tại thì "Tài khoản đã xóa". */
  name(id: string | null | undefined): string {
    if (!id) return '';
    const summary = this.known().get(id);
    if (summary === undefined) return '';
    return summary?.fullName || 'Tài khoản đã xóa';
  }

  email(id: string | null | undefined): string {
    return id ? this.known().get(id)?.email ?? '' : '';
  }
}
