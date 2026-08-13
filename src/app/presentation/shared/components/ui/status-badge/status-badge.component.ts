import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StatusVariant } from './status-badge.models';

export { StatusVariant } from './status-badge.models';

@Component({
  selector: 'app-status-badge',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './status-badge.component.html',
  styleUrls: ['./status-badge.component.scss']
})
export class StatusBadgeComponent {
  @Input() status: StatusVariant | string = 'info';
  @Input() text?: string;

  get badgeClasses(): string {
    const base = 'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-extrabold tracking-wide uppercase border transition-colors shadow-xs';
    switch (this.status.toLowerCase()) {
      case 'pending':
        return `${base} bg-amber-50 text-amber-700 border-amber-200`;
      case 'approved':
      case 'active':
      case 'activated':
        return `${base} bg-emerald-50 text-emerald-700 border-emerald-200`;
      case 'rejected':
      case 'inactive':
        return `${base} bg-rose-50 text-rose-700 border-rose-200`;
      case 'info':
      default:
        return `${base} bg-sky-50 text-sky-700 border-sky-200`;
    }
  }

  get dotClasses(): string {
    switch (this.status.toLowerCase()) {
      case 'pending': return 'bg-amber-500 animate-pulse';
      case 'approved':
      case 'active':
      case 'activated': return 'bg-emerald-500';
      case 'rejected':
      case 'inactive': return 'bg-rose-500';
      case 'info':
      default: return 'bg-sky-500';
    }
  }
}
