import crypto from "node:crypto";
import jwt from "jsonwebtoken";

const accessTokenTtlSeconds = 15 * 60;
const refreshTokenTtlMs = 7 * 24 * 60 * 60 * 1000;

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is required");
  }
  return secret;
}

export function createAccessToken(userId: string, role: string) {
  return jwt.sign({ sub: userId, role }, getJwtSecret(), {
    expiresIn: accessTokenTtlSeconds,
  });
}

export function createRefreshToken() {
  return {
    value: crypto.randomBytes(48).toString("hex"),
    expiresAt: new Date(Date.now() + refreshTokenTtlMs),
  };
}

export function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function createOneTimeToken() {
  return crypto.randomBytes(32).toString("hex");
}
