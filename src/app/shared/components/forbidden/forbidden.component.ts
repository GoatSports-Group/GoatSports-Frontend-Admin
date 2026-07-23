import { Component } from '@angular/core';

@Component({
    selector: 'app-forbidden',
    templateUrl: './forbidden.component.html',
    styleUrls: ['./forbidden.component.scss'],
    standalone: false
})
export class ForbiddenComponent {
  goToClient() {
    window.location.href = import.meta.env.NG_APP_CLIENT_API_URL;
  }
}
