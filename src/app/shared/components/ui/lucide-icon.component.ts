import { Component, Input } from '@angular/core';
import { LucideDynamicIcon } from '@lucide/angular';

@Component({
  selector: 'lucide-icon',
  standalone: true,
  imports: [LucideDynamicIcon],
  template: `<svg [lucideIcon]="name" [class]="class"></svg>`,
  styles: [`
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      line-height: 0;
    }
  `]
})
export class LucideIconComponent {
  @Input() name!: string;
  @Input() class: string = '';
}
