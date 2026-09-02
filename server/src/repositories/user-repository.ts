import type { User } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { normalizeUsername } from "../lib/validation.js";

export type UserRecord = User;

export type CreateUserInput = {
  name: string;
  username: string;
  passwordHash: string;
};

export type UserRepository = {
  findById(id: string): Promise<UserRecord | null>;
  findByUsername(username: string): Promise<UserRecord | null>;
  create(input: CreateUserInput): Promise<UserRecord>;
  updateProfile(
    id: string,
    data: { name?: string; username?: string },
  ): Promise<UserRecord>;
  updatePasswordHash(id: string, passwordHash: string): Promise<UserRecord>;
};

export const userRepository: UserRepository = {
  findById(id) {
    return prisma.user.findUnique({ where: { id } });
  },

  findByUsername(username) {
    return prisma.user.findUnique({
      where: { username: normalizeUsername(username) },
    });
  },

  create(input) {
    return prisma.user.create({
      data: {
        name: input.name,
        username: normalizeUsername(input.username),
        passwordHash: input.passwordHash,
      },
    });
  },

  updateProfile(id, data) {
    return prisma.user.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.username !== undefined
          ? { username: normalizeUsername(data.username) }
          : {}),
      },
    });
  },

  updatePasswordHash(id, passwordHash) {
    return prisma.user.update({
      where: { id },
      data: { passwordHash },
    });
  },
};
