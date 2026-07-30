export { User } from '@domain/entities/user';

export { RoleEnum, ROLE_ENUM_OPTIONS } from '@domain/enums/role.enum';

export { GENDER_ENUM_OPTIONS } from "@domain/enums/gender-type.enum"

export interface CreateUserRequest {
    username: string;
    fullName: string;
    email: string;
    gender: string;
    password: string;
}