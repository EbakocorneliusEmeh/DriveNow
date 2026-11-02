
"use client";

import Link from "next/link";

export default function SettingsLink() {
  return (
    <Link
      href="/profile"
      className="flex items-center gap-3 rounded-xl px-4 py-3 text-[#68756f] transition hover:bg-[#f4f1eb] hover:text-[#123b35]"
    >
      <span>⚙️</span> Settings
    </Link>
  );
}