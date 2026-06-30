import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';
import { RoleRepository } from '@application/ports/persistence/role.repository';
import { RoleApi } from '@infrastructure/api/role.api';
import { RoleCreateRequest, RoleUpdateRequest } from '@application/dto/role/role.dto';
import { Role } from "@domain/entity/role"
import { PageFilter } from '@application/dto/page.filter';

@Injectable({
  providedIn: 'root'
})
export class RoleRepositoryImpl implements RoleRepository {
  private roleApi = inject(RoleApi);

  getRoles(filter: PageFilter): Observable<Role[]> {
    return this.roleApi.getRoles(filter).pipe(
      map(response => response.data?.result || [])
    );
  }

  getRoleById(id: string): Observable<Role> {
    return this.roleApi.getRoleById(id).pipe(
      map(response => response.data)
    );
  }

  createRole(payload: RoleCreateRequest): Observable<Role> {
    return this.roleApi.createRole(payload).pipe(
      map(response => response.data)
    );
  }

  updateRole(payload: RoleUpdateRequest): Observable<Role> {
    return this.roleApi.updateRole(payload).pipe(
      map(response => response.data)
    );
  }

  deleteRole(id: string): Observable<void> {
    return this.roleApi.deleteRole(id).pipe(
      map(response => response.data)
    );
  }

  activateRole(id: string): Observable<Role> {
    return this.roleApi.activateRole(id).pipe(
      map(response => response.data)
    );
  }

  deactivateRole(id: string): Observable<Role> {
    return this.roleApi.deactivateRole(id).pipe(
      map(response => response.data)
    );
  }
}
