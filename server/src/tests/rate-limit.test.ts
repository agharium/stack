import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { configureTrustProxy } from "../lib/trust-proxy.js";
import {
  RATE_LIMIT_MESSAGES,
  createAuthRateLimiters,
} from "../middleware/rate-limit.js";
import { createTestApp } from "./test-app.js";

function uniqueIp(suffix: string): string {
  const n = Number.parseInt(suffix.replace(/\D/g, "").slice(0, 6) || "1", 10);
  return `203.0.113.${(n % 250) + 1}`;
}

describe("rate limit de cadastro", () => {
  it("permite tentativas normais antes do limite", async () => {
    const app = createTestApp({
      registerShortLimit: 5,
      registerDailyLimit: 20,
    });
    const ip = uniqueIp("reg-ok");

    for (let index = 0; index < 5; index += 1) {
      const response = await request(app)
        .post("/api/auth/register")
        .set("X-Forwarded-For", ip)
        .send({
          name: "Teste",
          username: `user${index}`,
          password: "senha1234",
          confirmPassword: "senha1234",
        });
      expect(response.status).not.toBe(429);
    }
  });

  it("bloqueia cadastro com HTTP 429 após o limite curto", async () => {
    const app = createTestApp({
      registerShortLimit: 5,
      registerDailyLimit: 100,
    });
    const ip = uniqueIp("reg-short");

    for (let index = 0; index < 5; index += 1) {
      await request(app)
        .post("/api/auth/register")
        .set("X-Forwarded-For", ip)
        .send({
          name: "Teste",
          username: `short${index}`,
          password: "senha1234",
          confirmPassword: "senha1234",
        });
    }

    const blocked = await request(app)
      .post("/api/auth/register")
      .set("X-Forwarded-For", ip)
      .send({
        name: "Teste",
        username: "shortblock",
        password: "senha1234",
        confirmPassword: "senha1234",
      });

    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toBe(RATE_LIMIT_MESSAGES.register);
  });

  it("bloqueia cadastro com HTTP 429 após o limite diário", async () => {
    const app = createTestApp({
      registerShortLimit: 100,
      registerDailyLimit: 3,
    });
    const ip = uniqueIp("reg-daily");

    for (let index = 0; index < 3; index += 1) {
      await request(app)
        .post("/api/auth/register")
        .set("X-Forwarded-For", ip)
        .send({
          name: "Teste",
          username: `daily${index}`,
          password: "senha1234",
          confirmPassword: "senha1234",
        });
    }

    const blocked = await request(app)
      .post("/api/auth/register")
      .set("X-Forwarded-For", ip)
      .send({
        name: "Teste",
        username: "dailyblock",
        password: "senha1234",
        confirmPassword: "senha1234",
      });

    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toBe(RATE_LIMIT_MESSAGES.register);
  });
});

describe("rate limit de login", () => {
  it("permite tentativas falhas antes do limite", async () => {
    const app = createTestApp({ loginFailedLimit: 10 });
    const ip = uniqueIp("login-ok");

    for (let index = 0; index < 10; index += 1) {
      const response = await request(app)
        .post("/api/auth/login")
        .set("X-Forwarded-For", ip)
        .send({ username: "alguem", password: "errada123" });
      expect(response.status).not.toBe(429);
      expect(response.body.error).not.toContain("username");
    }
  });

  it("bloqueia login com HTTP 429 após falhas demais", async () => {
    const app = createTestApp({ loginFailedLimit: 10 });
    const ip = uniqueIp("login-block");

    for (let index = 0; index < 10; index += 1) {
      await request(app)
        .post("/api/auth/login")
        .set("X-Forwarded-For", ip)
        .send({ username: "vitima", password: "errada123" });
    }

    const blocked = await request(app)
      .post("/api/auth/login")
      .set("X-Forwarded-For", ip)
      .send({ username: "vitima", password: "errada123" });

    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toBe(RATE_LIMIT_MESSAGES.login);
    expect(JSON.stringify(blocked.body)).not.toContain("passwordHash");
  });

  it("login bem-sucedido reseta falhas anteriores e permite novas tentativas", async () => {
    const limiters = createAuthRateLimiters({ loginFailedLimit: 3 });
    const app = express();
    configureTrustProxy(app);
    app.use(express.json());
    app.post("/login", limiters.loginFailed, (request, response) => {
      if (request.body?.password === "correta") {
        response.json({ ok: true });
        return;
      }
      response.status(401).json({ error: "Usuário ou senha inválidos." });
    });

    const ip = uniqueIp("login-clear");

    await request(app)
      .post("/login")
      .set("X-Forwarded-For", ip)
      .send({ username: "maria", password: "errada" });
    await request(app)
      .post("/login")
      .set("X-Forwarded-For", ip)
      .send({ username: "maria", password: "errada" });

    const success = await request(app)
      .post("/login")
      .set("X-Forwarded-For", ip)
      .send({ username: "maria", password: "correta" });
    expect(success.status).toBe(200);

    for (let index = 0; index < 3; index += 1) {
      const response = await request(app)
        .post("/login")
        .set("X-Forwarded-For", ip)
        .send({ username: "maria", password: "errada" });
      expect(response.status).toBe(401);
    }

    const blocked = await request(app)
      .post("/login")
      .set("X-Forwarded-For", ip)
      .send({ username: "maria", password: "errada" });
    expect(blocked.status).toBe(429);
  });
});

describe("rate limit não afeta gameplay/API geral", () => {
  it("não aplica os limites de auth em endpoints de consulta", async () => {
    const app = createTestApp({
      registerShortLimit: 1,
      registerDailyLimit: 1,
      loginFailedLimit: 1,
    });
    const ip = uniqueIp("gameplay");

    await request(app)
      .post("/api/auth/register")
      .set("X-Forwarded-For", ip)
      .send({
        name: "Teste",
        username: "limitado",
        password: "senha1234",
        confirmPassword: "senha1234",
      });

    for (let index = 0; index < 5; index += 1) {
      const me = await request(app)
        .get("/api/auth/me")
        .set("X-Forwarded-For", ip);
      expect(me.status).toBe(200);

      const ranking = await request(app)
        .get("/api/ranking")
        .set("X-Forwarded-For", ip);
      expect(ranking.status).not.toBe(429);

      const health = await request(app)
        .get("/api/health")
        .set("X-Forwarded-For", ip);
      // /api/health is mounted on main app, not test app — skip if missing
      if (health.status !== 404) {
        expect(health.status).not.toBe(429);
      }
    }
  });
});
