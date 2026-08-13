import { Component, Input, Output, EventEmitter } from '@angular/core';
import { User } from '@application/dto/user/user.dto';
import { getDisplayAvatar, getGenderLabel, getRoleLabel } from '@shared/utils/user-display.utils';

@Component({
  selector: 'app-user-details',
  templateUrl: './user-details.component.html',
  styleUrls: ['./user-details.component.scss'],
  standalone: false
})
export class UserDetailsComponent {
  readonly getDisplayAvatar = getDisplayAvatar;
  readonly getFallbackRole = getRoleLabel;
  readonly getFallbackGender = getGenderLabel;
  @Input() selectedUser!: User;
  @Input() loadingDetails = false;

  @Output() close = new EventEmitter<void>();
  @Output() edit = new EventEmitter<User>();
  @Output() assignRole = new EventEmitter<User>();
  @Output() changePassword = new EventEmitter<User>();
  @Output() toggleVerification = new EventEmitter<{ user: User; verified: boolean }>();

}
