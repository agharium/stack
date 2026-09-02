import { Router } from "express";
import * as authController from "../controllers/auth-controller.js";
import * as profileController from "../controllers/profile-controller.js";
import * as rankingController from "../controllers/ranking-controller.js";
import { optionalAuth, requireAuth } from "../middleware/auth.js";

export function createApiRouter(): Router {
  const router = Router();

  router.use(optionalAuth);

  router.post("/auth/register", (request, response) =>
    void authController.register(request, response),
  );
  router.post("/auth/login", (request, response) =>
    void authController.login(request, response),
  );
  router.post("/auth/logout", (request, response) =>
    authController.logout(request, response),
  );
  router.get("/auth/me", (request, response) =>
    void authController.me(request, response),
  );

  router.get("/profile", requireAuth, (request, response) =>
    void profileController.getProfile(request, response),
  );
  router.patch("/profile", requireAuth, (request, response) =>
    void profileController.updateProfile(request, response),
  );
  router.patch("/profile/password", requireAuth, (request, response) =>
    void profileController.changePassword(request, response),
  );

  router.get("/ranking", (request, response) =>
    void rankingController.getRanking(request, response),
  );

  return router;
}
