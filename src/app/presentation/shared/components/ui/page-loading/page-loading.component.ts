import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { LoadingSkeletonComponent, SkeletonVariant } from '@shared/components/loading-skeleton/loading-skeleton.component';

export type PageLoadingSize = 'compact' | 'default';
/** `page` = header + KPI tiles + table (default admin workspace); other values render that skeleton only. */
export type PageLoadingLayout = 'page' | Exclude<SkeletonVariant, 'block' | 'text'>;

@Component({
  selector: 'app-page-loading',
  standalone: true,
  imports: [LoadingSkeletonComponent],
  templateUrl: './page-loading.component.html',
  styleUrl: './page-loading.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PageLoadingComponent {
  readonly title = input('Đang tải dữ liệu');
  readonly description = input('Vui lòng chờ trong giây lát.');
  readonly size = input<PageLoadingSize>('default');
  /** Shape of the skeleton; compact defaults to list rows, full size to the workspace page. */
  readonly layout = input<PageLoadingLayout | null>(null);
  readonly count = input(5);
  readonly columns = input(5);

  resolvedLayout(): PageLoadingLayout {
    return this.layout() ?? (this.size() === 'compact' ? 'rows' : 'page');
  }

  /** Skeleton variant for non-`page` layouts (templates don't narrow method results). */
  skeletonVariant(): SkeletonVariant {
    const layout = this.resolvedLayout();
    return layout === 'page' ? 'table' : layout;
  }
}
