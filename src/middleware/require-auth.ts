import type { RequestHandler, Response } from "express";
import { UserStatus } from "@prisma/client";
import { authService } from "../services/auth.service.js";
import { userService } from "../services/user.service.js";

export const requireDashboardAuth: RequestHandler = async (req, _res, next) => {
  try {
    const user = await authService.verifyDashboardRequest(req.header("authorization"), req.header("x-mock-user-id"));
    req.user = user;
    await userService.ensureUser(user.id, user.email);
    next();
  } catch (error) {
    next(error);
  }
};

export const requireApprovedStatus: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) {
      return (res as Response).status(401).json({ error: "Nicht authentifiziert" });
    }
    const status = await userService.getUserStatus(req.user.id);
    if (status !== UserStatus.APPROVED) {
      return (res as Response).status(403).json({
        error: "Zugriff verweigert",
        code: "WAITLIST",
        message: "Ihr Konto befindet sich auf der Warteliste. Wir informieren Sie, sobald Ihr Zugang freigeschaltet wird."
      });
    }
    next();
  } catch (error) {
    next(error);
  }
};
