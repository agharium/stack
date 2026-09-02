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

const BCRYPT_ROUNDS = 12;

export const AUTH_ERRORS = {
  invalidCredentials: "Usuário ou senha inválidos.",
  usernameTaken: "Esse username já está em uso.",
  dbUnavailable: "Não foi possível concluir essa operação agora.",
  sessionExpired: "Sua sessão expirou. Entre novamente.",
} as const;

function toPrivateAccount(user: {
  id: string;
  name: string;
  username: string;
}): PrivateAccountDto {
  return { id: user.id, name: user.name, username: user.username };
}

export class AuthService {
  constructor(private readonly users: UserRepository = userRepository) {}

  async register(input: {
    name: string;
    username: string;
    password: string;
    confirmPassword: string;
  }): Promise<PrivateAccountDto> {
    const name = validateName(input.name);
    const username = validateUsername(input.username);
    const password = validatePassword(input.password);
    if (password !== input.confirmPassword) {
      throw new Error("As senhas não coincidem.");
    }

    const existing = await this.users.findByUsername(username);
    if (existing) {
      throw new Error(AUTH_ERRORS.usernameTaken);
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await this.users.create({ name, username, passwordHash });
    return toPrivateAccount(user);
  }

  async login(input: {
    username: string;
    password: string;
  }): Promise<PrivateAccountDto> {
    const username = validateUsername(input.username);
    const user = await this.users.findByUsername(username);
    if (!user) {
      throw new Error(AUTH_ERRORS.invalidCredentials);
    }
    const valid = await bcrypt.compare(input.password, user.passwordHash);
    if (!valid) {
      throw new Error(AUTH_ERRORS.invalidCredentials);
    }
    return toPrivateAccount(user);
  }

  async getAccount(userId: string): Promise<PrivateAccountDto | null> {
    const user = await this.users.findById(userId);
    return user ? toPrivateAccount(user) : null;
  }
}

export const authService = new AuthService();
