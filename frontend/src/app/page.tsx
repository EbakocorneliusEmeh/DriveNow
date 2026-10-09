import Link from "next/link";

const benefits = [
  { number: "01", title: "Search with clarity", text: "Find the right vehicle by type, price, location, and availability." },
  { number: "02", title: "Book with confidence", text: "See transparent pricing and real availability before you commit." },
  { number: "03", title: "Meet trusted dealers", text: "Explore professional profiles and keep every conversation in one place." },
];

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#f4f1eb] text-[#18211f]">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6 sm:px-10 lg:px-14">
        <Link href="/" className="text-xl font-bold tracking-[-0.06em] text-[#123b35]">Drive<span className="text-[#d9a441]">Now</span></Link>
        <div className="hidden items-center gap-8 text-sm font-medium text-[#52605a] md:flex"><a href="#how-it-works" className="transition hover:text-[#123b35]">How it works</a><a href="#services" className="transition hover:text-[#123b35]">Services</a><a href="#dealers" className="transition hover:text-[#123b35]">For dealers</a></div>
        <div className="flex items-center gap-3"><Link href="/login" className="hidden rounded-full px-4 py-2 text-sm font-semibold text-[#123b35] transition hover:bg-white sm:block">Log in</Link><Link href="/register" className="rounded-full bg-[#123b35] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#1d5148]">Get started</Link></div>
      </nav>

      <section id="top" className="mx-auto grid max-w-7xl gap-10 px-6 pb-20 pt-12 sm:px-10 sm:pt-20 lg:grid-cols-[1.05fr_0.95fr] lg:px-14 lg:pb-32 lg:pt-24">
        <div className="flex flex-col justify-center"><p className="mb-6 text-xs font-bold uppercase tracking-[0.28em] text-[#c28d27]">The smarter way to move</p><h1 className="max-w-3xl text-6xl font-semibold leading-[0.9] tracking-[-0.07em] text-[#123b35] sm:text-8xl">Your road.<br /><span className="text-[#c28d27]">Your rhythm.</span></h1><p className="mt-8 max-w-lg text-lg leading-8 text-[#68756f]">Discover cars that fit the way you live. Rent for the weekend, buy for the long road, or list your own fleet with confidence.</p><div className="mt-10 flex flex-wrap gap-4"><Link href="/register" className="rounded-full bg-[#d9a441] px-7 py-4 text-sm font-bold text-[#18211f] transition hover:bg-[#e7b95b]">Find your next car <span className="ml-3">↗</span></Link><a href="#how-it-works" className="rounded-full border border-[#cfd5cd] px-7 py-4 text-sm font-bold text-[#123b35] transition hover:border-[#123b35]">Explore DriveNow</a></div></div>
        <div className="relative min-h-[420px] overflow-hidden rounded-[2rem] bg-[#d9a441] p-8 sm:min-h-[520px] sm:p-12"><div className="absolute -right-24 -top-24 h-80 w-80 rounded-full border-[4rem] border-[#123b35]/15" /><div className="absolute bottom-[-20%] left-[-12%] h-72 w-72 rounded-full bg-[#123b35]/15 blur-2xl" /><div className="relative flex h-full flex-col justify-between"><div className="flex justify-between text-xs font-bold uppercase tracking-[0.2em] text-[#123b35]/70"><span>DriveNow / 01</span><span>Since 2026</span></div><div><div className="mb-8 text-[9rem] leading-none sm:text-[13rem]">✦</div><p className="max-w-xs text-3xl font-semibold leading-tight tracking-[-0.05em] text-[#123b35]">More than a rental. A better way to get there.</p></div></div></div>
      </section>

      <section id="how-it-works" className="bg-[#123b35] px-6 py-20 text-[#f4f1eb] sm:px-10 lg:px-14 lg:py-28"><div className="mx-auto max-w-7xl"><div className="mb-14 flex flex-col justify-between gap-6 sm:flex-row sm:items-end"><div><p className="mb-4 text-xs font-bold uppercase tracking-[0.28em] text-[#d9a441]">A clearer journey</p><h2 className="max-w-xl text-4xl font-semibold leading-tight tracking-[-0.05em] sm:text-6xl">Everything you need, right where you need it.</h2></div><p className="max-w-xs text-sm leading-6 text-[#b8ccc5]">We are building a marketplace that makes every part of the journey feel considered.</p></div><div className="grid gap-px overflow-hidden rounded-2xl bg-[#477267] md:grid-cols-3">{benefits.map((benefit) => <article key={benefit.number} className="bg-[#123b35] p-7 sm:p-9"><p className="mb-16 text-sm text-[#d9a441]">{benefit.number}</p><h3 className="mb-4 text-2xl font-semibold tracking-[-0.04em]">{benefit.title}</h3><p className="text-sm leading-6 text-[#b8ccc5]">{benefit.text}</p></article>)}</div></div></section>

      <section id="services" className="mx-auto grid max-w-7xl gap-6 px-6 py-20 sm:px-10 lg:grid-cols-2 lg:px-14 lg:py-28"><article className="rounded-[1.5rem] bg-[#e4ded2] p-8 sm:p-12"><p className="mb-20 text-xs font-bold uppercase tracking-[0.25em] text-[#7c6949]">For every kind of trip</p><h2 className="max-w-md text-4xl font-semibold leading-tight tracking-[-0.06em] text-[#123b35]">Rent for now.<br />Buy for what&apos;s next.</h2><p className="mt-6 max-w-sm text-sm leading-6 text-[#68756f]">Flexible access to vehicles from businesses you can trust.</p></article><article id="dealers" className="rounded-[1.5rem] bg-[#d9a441] p-8 sm:p-12"><p className="mb-20 text-xs font-bold uppercase tracking-[0.25em] text-[#76571b]">For dealers and businesses</p><h2 className="max-w-md text-4xl font-semibold leading-tight tracking-[-0.06em] text-[#123b35]">Put your fleet<br />in motion.</h2><p className="mt-6 max-w-sm text-sm leading-6 text-[#76571b]">List vehicles, manage bookings, and grow your business from one dashboard.</p></article></section>

      <footer className="mx-auto flex max-w-7xl flex-col justify-between gap-5 px-6 py-8 text-xs text-[#68756f] sm:flex-row sm:px-10 lg:px-14"><p className="font-bold tracking-[-0.03em] text-[#123b35]">Drive<span className="text-[#d9a441]">Now</span></p><p>Move with intention.</p><p>© 2026 DriveNow</p></footer>
    </main>
  );
}
