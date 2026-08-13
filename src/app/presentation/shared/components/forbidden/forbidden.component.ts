import { Component } from '@angular/core';
import { environment } from "@environments/environment"

@Component({
  selector: 'app-forbidden',
  templateUrl: './forbidden.component.html',
  styleUrls: ['./forbidden.component.scss'],
  standalone: false
})
export class ForbiddenComponent {
  goToClient() {
    window.location.href = environment.clientApiUrl;
  }
}
