import { Inject, Injectable } from "@angular/core";
import { CreateUserRequest, User } from "@application/dto/user/user.dto";
import { USER_REPOSITORY_TOKEN, UserRepository } from "@application/ports/persistence/user.repository";
import { Observable } from "rxjs";

@Injectable({
    providedIn: 'root'
})
export class CreateUserUseCase {
    constructor(
        @Inject(USER_REPOSITORY_TOKEN) private userRepository: UserRepository
    ) { }

    execute(request: CreateUserRequest): Observable<User> {
        return this.userRepository.createUser(request);
    }
}