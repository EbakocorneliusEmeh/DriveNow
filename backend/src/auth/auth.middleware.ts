import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

export type AuthenticatedRequest = Request & {
  user: { id: string; role: "customer" | "dealer" | "admin" };
};

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is required");
  }
  return secret;
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.header("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;

  if (!token) {
    res.status(401).json({ success: false, message: "Authentication required" });
    return;
  }

  try {
    const payload = jwt.verify(token, getJwtSecret());
    if (
      typeof payload === "string" ||
      typeof payload.sub !== "string" ||
      !["customer", "dealer", "admin"].includes(payload.role as string)
    ) {
      throw new Error("Invalid token payload");
    }

    (req as AuthenticatedRequest).user = {
      id: payload.sub,
      role: payload.role as "customer" | "dealer" | "admin",
    };
    next();
  } catch {
    res.status(401).json({ success: false, message: "Invalid or expired access token" });
  }
}

export function requireRole(...allowedRoles: AuthenticatedRequest["user"]["role"][]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as AuthenticatedRequest).user;
    if (!user) {
      res.status(401).json({ success: false, message: "Authentication required" });
      return;
    }

    if (!allowedRoles.includes(user.role)) {
      res.status(403).json({ success: false, message: "You do not have permission to perform this action" });
      return;
    }

    next();
  };
}
