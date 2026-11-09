import { NextResponse } from "next/server";

export async function GET() {
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };

  const missing = Object.entries(config).filter(([, value]) => !value).map(([key]) => key);
  if (missing.length > 0) {
    return NextResponse.json(
      { error: `Missing Firebase web config values: ${missing.join(", ")}` },
      { status: 500 },
    );
  }

  return NextResponse.json(config);
}
