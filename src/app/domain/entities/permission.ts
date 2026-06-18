export interface Permission {
  permissionId: string;
  name: string;
  apiPath: string;
  method: string;
  module: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PermissionListResult {
  meta: {
    page: number;
    pageSize: number;
    pages: number;
    total: number;
  };
  result: Permission[];
}
