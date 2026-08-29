import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-venue-owner-submission-loader',
  standalone: true,
  template: `
    <section class="submission-card" role="status" aria-live="polite" aria-modal="true">
      <span class="submission-card__spinner" aria-hidden="true"></span>
      <h2>Đang tạo hồ sơ chủ sân</h2>
      <p>Hệ thống đang tải tài liệu và gửi đơn đăng ký.<br>Vui lòng không đóng hoặc tải lại trang.</p>
    </section>
  `,
  styles: `
    :host {
      display: block;
      width: min(440px, calc(100vw - 40px));
      font-family: 'Be Vietnam Pro', sans-serif;
    }

    .submission-card {
      box-sizing: border-box;
      width: 100%;
      padding: 32px;
      border: 1px solid rgb(226 232 240 / 85%);
      border-radius: 22px;
      background: #fff;
      box-shadow: 0 28px 70px rgb(15 23 42 / 28%);
      text-align: center;
    }

    .submission-card__spinner {
      display: inline-block;
      width: 42px;
      height: 42px;
      border: 4px solid #d1fae5;
      border-top-color: #059669;
      border-radius: 50%;
      animation: spin .8s linear infinite;
    }

    h2 {
      margin: 14px 0 4px;
      color: #059669;
      font-size: 17px;
      font-weight: 800;
    }

    p {
      margin: 0;
      color: #64748b;
      font-size: 15px;
      line-height: 1.7;
    }

    @keyframes spin { to { transform: rotate(360deg); } }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VenueOwnerSubmissionLoaderComponent { }
