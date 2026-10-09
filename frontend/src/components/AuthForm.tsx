"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

const API_URL = "http://localhost:4000/api/auth";

type AuthMode = "register" | "login";
type VerificationTokens = { email: string; phone: string };
type ApiResponse = {
  success: boolean;
  message?: string;
  data?: { verificationTokens?: VerificationTokens; accessToken?: string };
};

export default function AuthForm({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [message, setMessage] = useState("");
  const [tokens, setTokens] = useState<VerificationTokens>();
  const [accessToken, setAccessToken] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    const body = mode === "register" ? { fullName, email, phone, password } : { identifier, password };

    try {
      const response = await fetch(`${API_URL}/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = (await response.json()) as ApiResponse;
      if (!response.ok || !result.success) throw new Error(result.message ?? "Something went wrong");
      setMessage(result.message ?? (mode === "register" ? "Account created" : "Logged in"));
      if (result.data?.verificationTokens) setTokens(result.data.verificationTokens);
      if (result.data?.accessToken) {
        setAccessToken(result.data.accessToken);
        sessionStorage.setItem("drivenow_access_token", result.data.accessToken);
        router.push("/dashboard");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to connect to the backend");
    } finally {
      setLoading(false);
    }
  }

  async function verify(type: "email_verification" | "phone_verification") {
    const token = type === "email_verification" ? tokens?.email : tokens?.phone;
    if (!token) return;
    const response = await fetch(`${API_URL}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, type }),
    });
    const result = (await response.json()) as ApiResponse;
    setMessage(result.message ?? "Verification complete");
  }

  return (
    <main className="min-h-screen bg-[#f4f1eb] px-5 py-8 text-[#18211f] sm:px-10 sm:py-12">
      <div className="mx-auto grid min-h-[calc(100vh-6rem)] max-w-6xl overflow-hidden rounded-[2rem] bg-[#123b35] shadow-2xl shadow-[#123b35]/20 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="relative overflow-hidden p-8 text-[#f4f1eb] sm:p-12 lg:p-16">
          <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full border-[3rem] border-[#d9a441]/30" />
          <div className="relative flex h-full flex-col justify-between gap-16">
            <Link href="/" className="text-sm font-bold uppercase tracking-[0.3em] text-[#d9a441]">DriveNow</Link>
            <div><p className="mb-5 text-sm uppercase tracking-[0.2em] text-[#b8ccc5]">Your journey starts here</p><h1 className="max-w-lg text-5xl font-semibold leading-[0.95] tracking-[-0.05em] sm:text-7xl">Move freely.<br />Arrive fully.</h1></div>
            <p className="max-w-sm text-lg leading-8 text-[#dce9e3]">Rent, buy, or list vehicles with a marketplace built around your next move.</p>
          </div>
        </section>

        <section className="bg-[#fffdf9] p-6 sm:p-12 lg:p-16">
          <div className="mx-auto max-w-md">
            <div className="mb-10 flex gap-8 border-b border-[#d9ded8]"><Link href="/register" className={`border-b-2 pb-4 text-sm font-semibold ${mode === "register" ? "border-[#d9a441] text-[#123b35]" : "border-transparent text-[#75817c]"}`}>Register</Link><Link href="/login" className={`border-b-2 pb-4 text-sm font-semibold ${mode === "login" ? "border-[#d9a441] text-[#123b35]" : "border-transparent text-[#75817c]"}`}>Log in</Link></div>
            <h2 className="mb-2 text-3xl font-semibold tracking-[-0.04em] text-[#123b35]">{mode === "register" ? "Create your account" : "Welcome back"}</h2>
            <p className="mb-8 text-sm leading-6 text-[#68756f]">{mode === "register" ? "Join DriveNow with your contact details." : "Log in with your email or phone number."}</p>
            <form onSubmit={submit} className="space-y-4">
              {mode === "register" && <input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Full name" required className="field" />}
              {mode === "register" ? <><input value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="Email address" required className="field" /><input value={phone} onChange={(event) => setPhone(event.target.value)} type="tel" placeholder="Phone number" required className="field" /></> : <input value={identifier} onChange={(event) => setIdentifier(event.target.value)} placeholder="Email or phone number" required className="field" />}
              <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="Password" required className="field" />
              <button disabled={loading} className="w-full rounded-xl bg-[#d9a441] px-5 py-4 text-sm font-bold text-[#18211f] transition hover:bg-[#e7b95b] disabled:opacity-60">{loading ? "Please wait..." : mode === "register" ? "Create account" : "Log in"}</button>
            </form>
            {message && <p className="mt-5 rounded-xl bg-[#edf4ef] p-4 text-sm leading-6 text-[#245c4c]">{message}</p>}
            {tokens && <div className="mt-6 space-y-3 rounded-2xl border border-[#e4dfd3] bg-[#faf7f0] p-5 text-xs text-[#52605a]"><p className="font-semibold text-[#123b35]">Development verification</p><button type="button" onClick={() => verify("email_verification")} className="token-button">Verify email token</button><button type="button" onClick={() => verify("phone_verification")} className="token-button">Verify phone token</button></div>}
            {accessToken && <div className="mt-6 rounded-2xl bg-[#123b35] p-5 text-xs text-[#dce9e3]"><p className="mb-2 font-semibold text-[#d9a441]">Session created</p><p className="break-all">Access token: {accessToken}</p></div>}
          </div>
        </section>
      </div>
    </main>
  );
}
