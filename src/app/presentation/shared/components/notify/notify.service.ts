import { Injectable, signal } from '@angular/core';

export type NotifyType = 'success' | 'error' | 'warning' | 'info';

export interface NotifyItem {
  id: number;
  message: string;
  type: NotifyType;
  title: string;
}

export interface LegacyNotifyConfig {
  panelClass?: string | string[];
  [key: string]: unknown;
}

@Injectable({ providedIn: 'root' })
export class NotifyService {
  readonly items = signal<NotifyItem[]>([]);
  private sequence = 0;

  success(message: string, title = 'Thành công'): void {
    this.show(message, 'success', title);
  }

  error(message: string, title = 'Có lỗi xảy ra'): void {
    this.show(message, 'error', title);
  }

  warning(message: string, title = 'Cần kiểm tra'): void {
    this.show(message, 'warning', title);
  }

  info(message: string, title = 'Thông báo'): void {
    this.show(message, 'info', title);
  }

  open(message: string, _action?: string, config?: LegacyNotifyConfig): void {
    const classNames = Array.isArray(config?.panelClass)
      ? config.panelClass.join(' ')
      : config?.panelClass ?? '';
    const normalizedMessage = message.toLocaleLowerCase('vi');
    const isValidation = ['không được để trống', 'không hợp lệ', 'không khớp', 'phải có ít nhất']
      .some(fragment => normalizedMessage.includes(fragment));
    const isError = ['không thể', 'thất bại', 'có lỗi', 'xảy ra lỗi']
      .some(fragment => normalizedMessage.includes(fragment));
    const type: NotifyType = classNames.includes('success') || normalizedMessage.includes('thành công')
      ? 'success'
      : classNames.includes('error') || isError
        ? 'error'
        : classNames.includes('warn') || isValidation
          ? 'warning'
          : 'info';

    this.show(message, type, this.defaultTitle(type));
  }

  dismiss(id: number): void {
    this.items.update(items => items.filter(item => item.id !== id));
  }

  private defaultTitle(type: NotifyType): string {
    return {
      success: 'Thành công',
      error: 'Có lỗi xảy ra',
      warning: 'Cần kiểm tra',
      info: 'Thông báo'
    }[type];
  }

  private show(message: string, type: NotifyType, title: string): void {
    const id = ++this.sequence;
    this.items.update(items => [...items.slice(-3), { id, message, type, title }]);
    window.setTimeout(() => this.dismiss(id), 3000);
  }
}
