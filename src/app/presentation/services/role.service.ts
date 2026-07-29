import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Role, RoleCreateRequest, RoleUpdateRequest } from '@application/dto/role/role.dto';
import { PageFilter } from '@application/dto/page.filter';
import { GetRolesUseCase } from '@application/usecase/role/get-roles.usecase';
import { GetRoleByIdUseCase } from '@application/usecase/role/get-role-by-id.usecase';
import { CreateRoleUseCase } from '@application/usecase/role/create-role.usecase';
import { UpdateRoleUseCase } from '@application/usecase/role/update-role.usecase';
import { DeleteRoleUseCase } from '@application/usecase/role/delete-role.usecase';
import { ActivateRoleUseCase } from '@application/usecase/role/activate-role.usecase';
import { DeactivateRoleUseCase } from '@application/usecase/role/deactivate-role.usecase';
import { BaseListResponse } from '@application/dto/base/base-response';

@Injectable({
  providedIn: 'root'
})
export class RoleService {
  private getRolesUseCase = inject(GetRolesUseCase);
  private getRoleByIdUseCase = inject(GetRoleByIdUseCase);
  private createRoleUseCase = inject(CreateRoleUseCase);
  private updateRoleUseCase = inject(UpdateRoleUseCase);
  private deleteRoleUseCase = inject(DeleteRoleUseCase);
  private activateRoleUseCase = inject(ActivateRoleUseCase);
  private deactivateRoleUseCase = inject(DeactivateRoleUseCase);

  getRoles(filter: PageFilter): Observable<BaseListResponse<Role>> {
    return this.getRolesUseCase.execute(filter);
  }

  getRoleById(id: string): Observable<Role> {
    return this.getRoleByIdUseCase.execute(id);
  }

  createRole(payload: RoleCreateRequest): Observable<Role> {
    return this.createRoleUseCase.execute(payload);
  }

  updateRole(payload: RoleUpdateRequest): Observable<Role> {
    return this.updateRoleUseCase.execute(payload);
  }

  deleteRole(id: string): Observable<void> {
    return this.deleteRoleUseCase.execute(id);
  }

  activateRole(id: string): Observable<Role> {
    return this.activateRoleUseCase.execute(id);
  }

  deactivateRole(id: string): Observable<Role> {
    return this.deactivateRoleUseCase.execute(id);
  }
}
