import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createTestApp } from "./test-app.js";

describe("API auth/me", () => {
  it("retorna authenticated=false para visitante", async () => {
    const app = createTestApp();
    const response = await request(app).get("/api/auth/me");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ authenticated: false, user: null });
  });
});

describe("API ranking", () => {
  it("pode ser consultado sem login", async () => {
    const app = createTestApp();
    const response = await request(app).get("/api/ranking");
    expect([200, 503]).toContain(response.status);
    expect(response.body).toHaveProperty("ranking");
  });
});

describe("home autenticado x convidado", () => {
  it("input de nome de jogo aparece somente para convidados", () => {
    const source = readFileSync(
      resolve(process.cwd(), "../client/src/App.tsx"),
      "utf8",
    );
    expect(source).toContain("{!authUser && (");
    expect(source).toContain("Seu nome");
    expect(source).toContain("refreshSocketSession");
    expect(source).toContain("autoConnect: false");
    expect(source).toContain("GUEST_NAME_SERVER_ERROR");
    expect(source).toMatch(
      /if \(!authUser\) \{[\s\S]*Informe seu nome para jogar como convidado/,
    );
    expect(source).toContain("authUser ? {} : { nickname: nickname.trim() }");
    expect(source).toContain("? { roomCode: code }");
    expect(source).toContain(
      ": { nickname: nickname.trim(), roomCode: code }",
    );
  });
});
