// Infrastructure: UserRepository (Supabase)
import type { IUserRepository } from "@/domain/contracts";
import type { User } from "@/domain/entities";
import { supabaseService } from "./client";
import { compare } from "bcryptjs";

export class SupabaseUserRepository implements IUserRepository {
    async findFirst(): Promise<User | null> {
        const { data, error } = await supabaseService
            .from("users")
            .select("*")
            .limit(1)
            .single();
        if (error || !data) return null;
        return data as User;
    }

    async findByPin(pin: string): Promise<User | null> {
        const user = await this.findFirst();
        if (!user) return null;
        const valid = await compare(pin, user.pin_hash);
        return valid ? user : null;
    }
}
