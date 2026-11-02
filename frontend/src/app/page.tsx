import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#f4f1eb] text-[#18211f]">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6 sm:px-10 lg:px-14">
        <Link href="/" className="text-xl font-bold tracking-[-0.06em] text-[#123b35]">Drive<span className="text-[#d9a441]">Now</span></Link>
        <div className="flex items-center gap-3"><Link href="/login" className="hidden rounded-full px-4 py-2 text-sm font-semibold text-[#123b35] transition hover:bg-white sm:block">Log in</Link><Link href="/register" className="rounded-full bg-[#123b35] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#1d5148]">Get started</Link></div>
      </nav>
    </main>
  );
}