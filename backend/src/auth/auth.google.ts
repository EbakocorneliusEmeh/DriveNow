import { OAuth2Client } from "google-auth-library";
import { db } from "../db/index.js";
import { refreshTokens, users } from "../db/schema.js";
import { createAccessToken, createRefreshToken, hashToken } from "./auth.tokens.js";
import { eq } from "drizzle-orm";

const client = new OAuth2Client();

export async function verifyGoogleToken(token: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new Error("GOOGLE_CLIENT_ID is required");
  }

  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: clientId,
    });
    const payload = ticket.getPayload();
    if (!payload) {
      const error = new Error("Invalid Google token");
      error.name = "InvalidGoogleTokenError";
      throw error;
    }
    if (payload.email_verified !== true) {
      const error = new Error("Google must verify your email address before you can sign in");
      error.name = "GoogleEmailNotVerifiedError";
      throw error;
    }
    return payload;
  } catch (error) {
    if (error instanceof Error && (
      error.name === "InvalidGoogleTokenError" ||
      error.name === "GoogleEmailNotVerifiedError"
    )) {
      throw error;
    }
    console.error("Error verifying Google token:", error);
    const invalidTokenError = new Error("Invalid Google token");
    invalidTokenError.name = "InvalidGoogleTokenError";
    throw invalidTokenError;
  }
}

export async function signInWithGoogle(
  googleId: string,
  email: string,
  fullName: string,
  avatarUrl: string,
  phone?: string,
) {
  let [user] = await db.select().from(users).where(eq(users.googleId, googleId)).limit(1);

  if (!user) {
    const [matchingEmailUser] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (matchingEmailUser) {
      if (matchingEmailUser.googleId && matchingEmailUser.googleId !== googleId) {
        const error = new Error("This email is already linked to another Google account");
        error.name = "ConflictError";
        throw error;
      }

      [user] = await db
        .update(users)
        .set({
          googleId,
          emailVerified: true,
          avatarUrl: avatarUrl || matchingEmailUser.avatarUrl,
          updatedAt: new Date(),
        })
        .where(eq(users.id, matchingEmailUser.id))
        .returning();
    } else {
      if (!phone) {
        return { needsPhone: true as const };
      }

      const [matchingPhoneUser] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.phone, phone))
        .limit(1);
      if (matchingPhoneUser) {
        const error = new Error("A user with this phone number already exists");
        error.name = "ConflictError";
        throw error;
      }

      [user] = await db
        .insert(users)
        .values({
          googleId,
          email,
          fullName,
          avatarUrl,
          phone,
          emailVerified: true,
        })
        .returning();
    }
  }

  if (!user) {
    throw new Error("Google account could not be created or linked");
  }

  const refreshToken = createRefreshToken();
  await db.insert(refreshTokens).values({
    userId: user.id,
    tokenHash: hashToken(refreshToken.value),
    expiresAt: refreshToken.expiresAt,
  });

  return {
    user: {
      id: user.id,
      fullName: user.fullName,
      avatarUrl: user.avatarUrl,
      email: user.email,
      phone: user.phone,
      role: user.role,
    },
    accessToken: createAccessToken(user.id, user.role),
    refreshToken: refreshToken.value,
  };
}