// Application Use-Case: Login with PIN
import type { IUserRepository, ISessionRepository } from "@/domain/contracts";
import { compare } from "bcryptjs";
import { SignJWT } from "jose";

const JWT_SECRET = new TextEncoder().encode(
    process.env.JWT_SECRET ?? "change-me-in-production-at-least-32-chars"
);

export interface LoginResult {
    token: string;
    expiresAt: Date;
}

export async function loginWithPin(
    pin: string,
    userRepo: IUserRepository,
    sessionRepo: ISessionRepository
): Promise<LoginResult> {
    const user = await userRepo.findFirst();
    if (!user) {
        throw new Error("No user configured");
    }

    const valid = await compare(pin, user.pin_hash);
    if (!valid) {
        throw new Error("Invalid PIN");
    }

    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7 days

    const token = await new SignJWT({ sub: user.id })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime(expiresAt)
        .sign(JWT_SECRET);

    await sessionRepo.create(user.id, token, expiresAt);

    return { token, expiresAt };
}
