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
