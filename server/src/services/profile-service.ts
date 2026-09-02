import bcrypt from "bcryptjs";
import type { PrivateAccountDto } from "../types/auth.js";
import {
  userRepository,
  type UserRepository,
} from "../repositories/user-repository.js";
import {
  validateName,
  validatePassword,
  validateUsername,
} from "../lib/validation.js";
import { AUTH_ERRORS } from "./auth-service.js";

const BCRYPT_ROUNDS = 12;

function toPrivateAccount(user: {
  id: string;
  name: string;
  username: string;
}): PrivateAccountDto {
  return { id: user.id, name: user.name, username: user.username };
}

export class ProfileService {
  constructor(private readonly users: UserRepository = userRepository) {}

  async getProfile(userId: string): Promise<PrivateAccountDto | null> {
    const user = await this.users.findById(userId);
    return user ? toPrivateAccount(user) : null;
  }

  async updateProfile(
    userId: string,
    input: { name?: string; username?: string },
  ): Promise<PrivateAccountDto> {
    const current = await this.users.findById(userId);
    if (!current) {
      throw new Error(AUTH_ERRORS.sessionExpired);
    }

    const data: { name?: string; username?: string } = {};
    if (input.name !== undefined) {
      data.name = validateName(input.name);
    }
    if (input.username !== undefined) {
      const username = validateUsername(input.username);
      if (username !== current.username) {
        const taken = await this.users.findByUsername(username);
        if (taken && taken.id !== userId) {
          throw new Error("Esse username já está em uso.");
        }
      }
      data.username = username;
    }

    const updated = await this.users.updateProfile(userId, data);
    return toPrivateAccount(updated);
  }

  async changePassword(
    userId: string,
    input: {
      currentPassword: string;
      newPassword: string;
      confirmNewPassword: string;
    },
  ): Promise<void> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new Error(AUTH_ERRORS.sessionExpired);
    }

    const valid = await bcrypt.compare(input.currentPassword, user.passwordHash);
    if (!valid) {
      throw new Error("Senha atual incorreta.");
    }

    const newPassword = validatePassword(input.newPassword);
    if (newPassword !== input.confirmNewPassword) {
      throw new Error("As novas senhas não coincidem.");
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await this.users.updatePasswordHash(userId, passwordHash);
  }
}

export const profileService = new ProfileService();
