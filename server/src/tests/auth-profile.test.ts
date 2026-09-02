import bcrypt from "bcryptjs";
import { describe, expect, it } from "vitest";
import { AuthService } from "../services/auth-service.js";
import { ProfileService } from "../services/profile-service.js";
import { InMemoryUserRepository } from "./in-memory-repositories.js";

describe("registro e login", () => {
  it("cria usuário com senha hasheada", async () => {
    const users = new InMemoryUserRepository();
    const auth = new AuthService(users);
    const account = await auth.register({
      name: "Maria",
      username: "maria01",
      password: "senha1234",
      confirmPassword: "senha1234",
    });
    expect(account.name).toBe("Maria");
    const stored = await users.findByUsername("maria01");
    expect(stored?.passwordHash).not.toBe("senha1234");
    expect(await bcrypt.compare("senha1234", stored!.passwordHash)).toBe(true);
  });

  it("rejeita username duplicado", async () => {
    const users = new InMemoryUserRepository();
    const auth = new AuthService(users);
    await auth.register({
      name: "Maria",
      username: "maria01",
      password: "senha1234",
      confirmPassword: "senha1234",
    });
    await expect(
      auth.register({
        name: "Outra",
        username: "Maria01",
        password: "senha1234",
        confirmPassword: "senha1234",
      }),
    ).rejects.toThrow("Esse username já está em uso.");
  });

  it("login válido funciona", async () => {
    const users = new InMemoryUserRepository();
    const auth = new AuthService(users);
    await auth.register({
      name: "João",
      username: "joao",
      password: "senha1234",
      confirmPassword: "senha1234",
    });
    const account = await auth.login({
      username: "joao",
      password: "senha1234",
    });
    expect(account.name).toBe("João");
  });

  it("senha inválida falha com mensagem genérica", async () => {
    const users = new InMemoryUserRepository();
    const auth = new AuthService(users);
    await auth.register({
      name: "João",
      username: "joao",
      password: "senha1234",
      confirmPassword: "senha1234",
    });
    await expect(
      auth.login({ username: "joao", password: "errada123" }),
    ).rejects.toThrow("Usuário ou senha inválidos.");
  });

  it("credenciais inválidas não revelam se o username existe", async () => {
    const auth = new AuthService(new InMemoryUserRepository());
    await expect(
      auth.login({ username: "inexistente", password: "senha1234" }),
    ).rejects.toThrow("Usuário ou senha inválidos.");
  });

  it("nunca retorna passwordHash", async () => {
    const users = new InMemoryUserRepository();
    const auth = new AuthService(users);
    const account = await auth.register({
      name: "Ana",
      username: "ana",
      password: "senha1234",
      confirmPassword: "senha1234",
    });
    expect(account).not.toHaveProperty("passwordHash");
    const serialized = JSON.stringify(account);
    expect(serialized).not.toContain("passwordHash");
  });
});

describe("perfil", () => {
  it("lê e atualiza nome e username", async () => {
    const users = new InMemoryUserRepository();
    const auth = new AuthService(users);
    const profile = new ProfileService(users);
    const created = await auth.register({
      name: "Pedro",
      username: "pedro",
      password: "senha1234",
      confirmPassword: "senha1234",
    });
    const read = await profile.getProfile(created.id);
    expect(read?.username).toBe("pedro");

    const updated = await profile.updateProfile(created.id, {
      name: "Pedro Silva",
      username: "pedro.s",
    });
    expect(updated.name).toBe("Pedro Silva");
    expect(updated.username).toBe("pedro.s");
    expect(updated.id).toBe(created.id);
  });

  it("rejeita username duplicado no perfil", async () => {
    const users = new InMemoryUserRepository();
    const auth = new AuthService(users);
    const profile = new ProfileService(users);
    await auth.register({
      name: "Ana",
      username: "usera",
      password: "senha1234",
      confirmPassword: "senha1234",
    });
    const b = await auth.register({
      name: "Bia",
      username: "userb",
      password: "senha1234",
      confirmPassword: "senha1234",
    });
    await expect(
      profile.updateProfile(b.id, { username: "usera" }),
    ).rejects.toThrow("Esse username já está em uso.");
  });

  it("altera senha com validações", async () => {
    const users = new InMemoryUserRepository();
    const auth = new AuthService(users);
    const profile = new ProfileService(users);
    const created = await auth.register({
      name: "Luiza",
      username: "luiza",
      password: "senha1234",
      confirmPassword: "senha1234",
    });
    await expect(
      profile.changePassword(created.id, {
        currentPassword: "errada",
        newPassword: "nova12345",
        confirmNewPassword: "nova12345",
      }),
    ).rejects.toThrow("Senha atual incorreta.");

    await profile.changePassword(created.id, {
      currentPassword: "senha1234",
      newPassword: "nova12345",
      confirmNewPassword: "nova12345",
    });
    await expect(
      auth.login({ username: "luiza", password: "senha1234" }),
    ).rejects.toThrow("Usuário ou senha inválidos.");
    const relogin = await auth.login({
      username: "luiza",
      password: "nova12345",
    });
    expect(relogin.id).toBe(created.id);
  });
});
