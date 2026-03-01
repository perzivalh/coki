// Domain Contracts: Repository interfaces

import type { User } from "../entities";
import type { Session } from "../entities";

export interface IUserRepository {
    findFirst(): Promise<User | null>;
    findByPin(pin: string): Promise<User | null>;
}

export interface ISessionRepository {
    create(userId: string, token: string, expiresAt: Date): Promise<Session>;
    findByToken(token: string): Promise<Session | null>;
    deleteByToken(token: string): Promise<void>;
}
