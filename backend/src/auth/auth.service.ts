import bcrypt from "bcrypt";
import { createHash, randomUUID } from "node:crypto";
import { and, eq, gt, isNull, or } from "drizzle-orm";
import { db } from "../db/index.js";
import { authTokens, refreshTokens, users } from "../db/schema.js";
import type { LoginInput, RegisterInput, UpdateProfileInput } from "./auth.schemas.js";
import {
  createAccessToken,
  createOneTimeToken,
  createRefreshToken,
  hashToken,
} from "./auth.tokens.js";

const VERIFICATION_TOKEN_TTL_MS = 15 * 60 * 1000;
const PASSWORD_RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

const publicUserFields = {
  id: users.id,
  fullName: users.fullName,
  avatarUrl: users.avatarUrl,
  email: users.email,
  phone: users.phone,
  role: users.role,
};

export async function registerUser(input: RegisterInput) {
  const existingUser = await db
    .select({ id: users.id, email: users.email, phone: users.phone })
    .from(users)
    .where(or(eq(users.email, input.email), eq(users.phone, input.phone)))
    .limit(1);

  if (existingUser[0]) {
    const field = existingUser[0].email === input.email ? "email" : "phone";
    const error = new Error(`A user with this ${field} already exists`);
    error.name = "ConflictError";
    throw error;
  }

  const passwordHash = await bcrypt.hash(input.password, 12);
  const [user] = await db
    .insert(users)
    .values({
      fullName: input.fullName,
      email: input.email,
      phone: input.phone,
      passwordHash,
    })
    .returning({ id: users.id, fullName: users.fullName, email: users.email });

  if (!user) {
    throw new Error("User could not be created");
  }

  const emailVerificationToken = createOneTimeToken();
  const phoneVerificationToken = createOneTimeToken();
  await db.insert(authTokens).values([
    {
      userId: user.id,
      type: "email_verification",
      tokenHash: hashToken(emailVerificationToken),
      expiresAt: new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS),
    },
    {
      userId: user.id,
      type: "phone_verification",
      tokenHash: hashToken(phoneVerificationToken),
      expiresAt: new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS),
    },
  ]);

  return {
    user,
    // This will be sent by email/SMS once those providers are configured.
    verificationTokens:
      process.env.NODE_ENV === "production"
        ? undefined
        : {
            email: emailVerificationToken,
            phone: phoneVerificationToken,
          },
  };
}

export async function loginUser(input: LoginInput) {
  const identifier = input.identifier.toLowerCase();
  const [user] = await db
    .select()
    .from(users)
    .where(or(eq(users.email, identifier), eq(users.phone, input.identifier)))
    .limit(1);

  const validPassword = user ? await bcrypt.compare(input.password, user.passwordHash) : false;
  if (!user || !validPassword) {
    const error = new Error("Invalid email/phone or password");
    error.name = "InvalidCredentialsError";
    throw error;
  }

  if (!user.emailVerified || !user.phoneVerified) {
    const error = new Error("Verify your email and phone number before logging in");
    error.name = "UnverifiedUserError";
    throw error;
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
      email: user.email,
      phone: user.phone,
      role: user.role,
    },
    accessToken: createAccessToken(user.id, user.role),
    refreshToken: refreshToken.value,
  };
}

export async function refreshUserSession(refreshTokenValue: string) {
  const [storedToken] = await db
    .select({ id: refreshTokens.id, userId: refreshTokens.userId })
    .from(refreshTokens)
    .where(
      and(
        eq(refreshTokens.tokenHash, hashToken(refreshTokenValue)),
        isNull(refreshTokens.revokedAt),
        gt(refreshTokens.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (!storedToken) {
    const error = new Error("Invalid or expired refresh token");
    error.name = "InvalidTokenError";
    throw error;
  }

  const [user] = await db.select(publicUserFields).from(users).where(eq(users.id, storedToken.userId));
  if (!user) {
    const error = new Error("User account not found");
    error.name = "InvalidTokenError";
    throw error;
  }

  const nextRefreshToken = createRefreshToken();
  await db.transaction(async (transaction) => {
    await transaction
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.id, storedToken.id));
    await transaction.insert(refreshTokens).values({
      userId: user.id,
      tokenHash: hashToken(nextRefreshToken.value),
      expiresAt: nextRefreshToken.expiresAt,
    });
  });

  return {
    user,
    accessToken: createAccessToken(user.id, user.role),
    refreshToken: nextRefreshToken.value,
  };
}

export async function logoutUser(refreshTokenValue: string) {
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(
      and(eq(refreshTokens.tokenHash, hashToken(refreshTokenValue)), isNull(refreshTokens.revokedAt)),
    );
}

export async function getUserProfile(userId: string) {
  const [user] = await db.select(publicUserFields).from(users).where(eq(users.id, userId));
  return user;
}

export async function updateUserProfile(userId: string, input: UpdateProfileInput) {
  const [user] = await db
    .update(users)
    .set({ fullName: input.fullName, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning(publicUserFields);
  return user;
}

const imageTypes = {
  "image/jpeg": { extension: "jpg", matches: (data: Buffer) => data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff },
  "image/png": { extension: "png", matches: (data: Buffer) => data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  "image/webp": { extension: "webp", matches: (data: Buffer) => data.toString("ascii", 0, 4) === "RIFF" && data.toString("ascii", 8, 12) === "WEBP" },
} as const;

export async function updateUserProfilePicture(
  userId: string,
  contentType: string,
  image: Buffer,
) {
  const imageType = imageTypes[contentType as keyof typeof imageTypes];
  if (!imageType || !imageType.matches(image)) {
    const error = new Error("Choose a valid JPEG, PNG, or WebP image");
    error.name = "InvalidProfileImageError";
    throw error;
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    const error = new Error("Profile picture storage is not configured");
    error.name = "CloudinaryConfigError";
    throw error;
  }

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const publicId = `drivenow/profiles/${userId}/${randomUUID()}`;
  const signature = createHash("sha1")
    .update(`public_id=${publicId}&timestamp=${timestamp}${apiSecret}`)
    .digest("hex");
  const form = new FormData();
  const fileName = `profile.${imageType.extension}`;
  form.set("file", new Blob([new Uint8Array(image)], { type: contentType }), fileName);
  form.set("api_key", apiKey);
  form.set("public_id", publicId);
  form.set("timestamp", timestamp);
  form.set("signature", signature);

  let uploadResponse: Response;
  try {
    uploadResponse = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`, {
      method: "POST",
      body: form,
    });
  } catch {
    const error = new Error("Unable to reach profile picture storage");
    error.name = "CloudinaryUploadError";
    throw error;
  }

  const uploadResult = (await uploadResponse.json().catch(() => null)) as
    | { secure_url?: string; error?: { message?: string } }
    | null;
  if (!uploadResponse.ok || !uploadResult?.secure_url) {
    console.error("Cloudinary profile image upload failed", uploadResult?.error?.message ?? uploadResponse.statusText);
    const error = new Error("Unable to upload your profile picture");
    error.name = "CloudinaryUploadError";
    throw error;
  }

  const [user] = await db
    .update(users)
    .set({ avatarUrl: uploadResult.secure_url, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning(publicUserFields);
  if (!user) throw new Error("User account not found");
  return user;
}

export async function requestPasswordReset(identifier: string) {
  const normalizedIdentifier = identifier.toLowerCase();
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(or(eq(users.email, normalizedIdentifier), eq(users.phone, identifier)))
    .limit(1);

  // Do not reveal whether an account exists to callers.
  if (!user) return undefined;

  const token = createOneTimeToken();
  await db.insert(authTokens).values({
    userId: user.id,
    type: "password_reset",
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS),
  });

  return process.env.NODE_ENV === "production" ? undefined : token;
}

export async function resetUserPassword(token: string, password: string) {
  const [authToken] = await db
    .select({ id: authTokens.id, userId: authTokens.userId, expiresAt: authTokens.expiresAt, consumedAt: authTokens.consumedAt })
    .from(authTokens)
    .where(and(eq(authTokens.tokenHash, hashToken(token)), eq(authTokens.type, "password_reset")))
    .limit(1);

  if (!authToken || authToken.consumedAt || authToken.expiresAt <= new Date()) {
    const error = new Error("Password reset token is invalid or expired");
    error.name = "InvalidTokenError";
    throw error;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await db.transaction(async (transaction) => {
    await transaction.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, authToken.userId));
    await transaction.update(authTokens).set({ consumedAt: new Date() }).where(eq(authTokens.id, authToken.id));
    await transaction.update(refreshTokens).set({ revokedAt: new Date() }).where(eq(refreshTokens.userId, authToken.userId));
  });
}

export async function verifyUserContact(
  token: string,
  type: "email_verification" | "phone_verification",
) {
  const [authToken] = await db
    .select({
      id: authTokens.id,
      userId: authTokens.userId,
      expiresAt: authTokens.expiresAt,
      consumedAt: authTokens.consumedAt,
    })
    .from(authTokens)
    .where(
      and(eq(authTokens.tokenHash, hashToken(token)), eq(authTokens.type, type)),
    )
    .limit(1);

  if (!authToken || authToken.consumedAt || authToken.expiresAt <= new Date()) {
    const error = new Error("Verification token is invalid or expired");
    error.name = "InvalidTokenError";
    throw error;
  }

  await db.transaction(async (transaction) => {
    await transaction
      .update(authTokens)
      .set({ consumedAt: new Date() })
      .where(eq(authTokens.id, authToken.id));

    await transaction
      .update(users)
      .set(type === "email_verification" ? { emailVerified: true } : { phoneVerified: true })
      .where(eq(users.id, authToken.userId));
  });
}
