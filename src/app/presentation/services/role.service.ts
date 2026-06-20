import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseResponse } from '@application/dto/base/base-response';
import { Role, RoleCreateRequest, RoleUpdateRequest, RoleListResult } from '@application/dto/role/role.dto';
import { GetRolesUseCase } from '@application/usecase/role/get-roles.usecase';
import { GetRoleByIdUseCase } from '@application/usecase/role/get-role-by-id.usecase';
import { CreateRoleUseCase } from '@application/usecase/role/create-role.usecase';
import { UpdateRoleUseCase } from '@application/usecase/role/update-role.usecase';
import { DeleteRoleUseCase } from '@application/usecase/role/delete-role.usecase';
import { ActivateRoleUseCase } from '@application/usecase/role/activate-role.usecase';
import { DeactivateRoleUseCase } from '@application/usecase/role/deactivate-role.usecase';

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

  getRoles(page: number = 0, size: number = 100, search?: string): Observable<BaseResponse<RoleListResult>> {
    return this.getRolesUseCase.execute(page, size, search);
  }

  getRoleById(id: string): Observable<BaseResponse<Role>> {
    return this.getRoleByIdUseCase.execute(id);
  }

  createRole(payload: RoleCreateRequest): Observable<BaseResponse<Role>> {
    return this.createRoleUseCase.execute(payload);
  }

  updateRole(payload: RoleUpdateRequest): Observable<BaseResponse<Role>> {
    return this.updateRoleUseCase.execute(payload);
  }

  deleteRole(id: string): Observable<BaseResponse<void>> {
    return this.deleteRoleUseCase.execute(id);
  }

  activateRole(id: string): Observable<BaseResponse<Role>> {
    return this.activateRoleUseCase.execute(id);
  }

  deactivateRole(id: string): Observable<BaseResponse<Role>> {
    return this.deactivateRoleUseCase.execute(id);
  }
}
