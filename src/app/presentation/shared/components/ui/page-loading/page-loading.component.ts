import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type PageLoadingSize = 'compact' | 'default';

@Component({
  selector: 'app-page-loading',
  standalone: true,
  templateUrl: './page-loading.component.html',
  styleUrl: './page-loading.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PageLoadingComponent {
  readonly title = input('Đang tải dữ liệu');
  readonly description = input('Vui lòng chờ trong giây lát.');
  readonly size = input<PageLoadingSize>('default');
}
