"use client";

import { GoogleLogin, GoogleOAuthProvider } from "@react-oauth/google";

type GoogleSignInButtonProps = {
  disabled: boolean;
  onCredential: (token: string) => void;
  onError: (message: string) => void;
};

export default function GoogleSignInButton({
  disabled,
  onCredential,
  onError,
}: GoogleSignInButtonProps) {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  if (!clientId) {
    return (
      <p className="text-sm text-[#9b3b32]">
        Google sign-in is not configured. Set NEXT_PUBLIC_GOOGLE_CLIENT_ID in the frontend environment.
      </p>
    );
  }

  return (
    <GoogleOAuthProvider clientId={clientId}>
      <div className={disabled ? "pointer-events-none opacity-60" : ""}>
        <GoogleLogin
          onSuccess={(response) => {
            if (!response.credential) {
              onError("Google did not return an identity token. Please try again.");
              return;
            }
            onCredential(response.credential);
          }}
          onError={() => onError("Google sign-in was unsuccessful. Please try again.")}
          useOneTap={false}
          width="400"
        />
      </div>
    </GoogleOAuthProvider>
  );
}
