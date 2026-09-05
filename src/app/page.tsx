import { Space_Grotesk, Manrope } from "next/font/google";
import Link from "next/link";
import { buildPricingRecommendations } from "@/lib/engines/pricing";
import { buildSentimentSummary } from "@/lib/engines/sentiment";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-display",
  weight: ["500", "700"],
  subsets: ["latin"],
});

const manrope = Manrope({
  variable: "--font-body",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

const NAV_ITEMS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/revenue", label: "Revenue & Pricing" },
  { href: "/dashboard/guest-experience", label: "Guest Experience" },
  { href: "/dashboard/operations", label: "Operations" },
];

const ENGINE_COUNT = 6;

export default function LandingPage() {
  const pricing = buildPricingRecommendations();
  const sentiment = buildSentimentSummary();

  const revenueLift = `${pricing.projectedRevenueLift > 0 ? "+" : ""}${pricing.projectedRevenueLift}%`;

  return (
    <div
      className={`${spaceGrotesk.variable} ${manrope.variable} relative min-h-screen overflow-hidden bg-[#0a0c0f] text-[#f2f3f5]`}
      style={{ fontFamily: "var(--font-body), system-ui, -apple-system, sans-serif" }}
    >
      <div
        className="pointer-events-none absolute -top-56 left-1/2 h-[900px] w-[900px] -translate-x-1/2 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(79,140,255,0.28) 0%, rgba(79,140,255,0) 70%)" }}
      />
      <div
        className="pointer-events-none absolute left-[10%] top-[120px] h-[500px] w-[500px] rounded-full"
        style={{ background: "radial-gradient(circle, rgba(124,224,198,0.14) 0%, rgba(124,224,198,0) 70%)" }}
      />

      <nav className="relative flex items-center justify-between gap-2 px-4 py-5 md:px-16 md:py-6">
        <div className="flex min-w-0 items-center gap-2 md:gap-3">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" className="shrink-0 md:h-[30px] md:w-[30px]">
            <rect x="1" y="1" width="26" height="26" rx="8" fill="#12151a" stroke="rgba(255,255,255,0.14)" strokeWidth="1.5" />
            <path d="M5 18c2-3 4-3 6 0s4 3 6 0s4-3 6 0" stroke="#4f8cff" strokeWidth="2" strokeLinecap="round" fill="none" />
            <circle cx="14" cy="9" r="2.6" fill="#7ce0c6" />
          </svg>
          <span
            className="truncate whitespace-nowrap text-sm font-bold tracking-tight md:text-[17px]"
            style={{ fontFamily: "var(--font-display), sans-serif" }}
          >
            Smart Resort 360
          </span>
        </div>
        <div className="hidden items-center gap-9 md:flex">
          {NAV_ITEMS.map((item) => (
            <Link key={item.href} href={item.href} className="text-sm text-[#9aa1a9] transition-colors hover:text-[#f2f3f5]">
              {item.label}
            </Link>
          ))}
        </div>
        <div className="flex shrink-0 items-center gap-3 md:gap-5">
          <Link href="/dashboard" className="whitespace-nowrap text-xs text-[#d6d9dd] hover:text-white md:text-sm">
            Login
          </Link>
          <Link
            href="/dashboard"
            className="whitespace-nowrap rounded-full bg-[#4f8cff] px-3.5 py-2 text-xs font-bold text-[#08101f] transition-colors hover:bg-[#6ea0ff] md:px-5 md:py-2.5 md:text-sm"
          >
            Get started
          </Link>
        </div>
      </nav>

      <div className="relative flex flex-col items-center px-6 pt-16 text-center md:pt-20">
        <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/[0.14] px-4 py-1.5 text-xs uppercase tracking-wide text-[#b7cdff]">
          PS 5 · AI Resort Intelligence
        </div>
        <h1
          className="max-w-3xl text-5xl font-bold leading-[1.06] tracking-tight md:text-[62px]"
          style={{ fontFamily: "var(--font-display), sans-serif" }}
        >
          Stop guessing.
          <br />
          <span className="text-[#4f8cff]">Start optimizing</span>
          <br />
          your resort.
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-[#a7adb5]">
          Smart Resort 360 unifies pricing, guest sentiment, maintenance, and staffing into one AI-powered command
          center — every decision backed by data, not gut feel.
        </p>

        <form action="/dashboard" className="mt-9 flex w-full max-w-xs flex-col items-stretch gap-2.5 sm:max-w-none sm:w-auto sm:flex-row sm:items-center">
          <input
            name="property"
            type="text"
            placeholder="Enter your property name"
            className="w-full rounded-full border border-white/[0.16] bg-white/[0.04] px-[18px] py-3.5 text-[15px] text-[#f2f3f5] placeholder:text-[#767c85] focus:outline-none focus:border-[#4f8cff] sm:w-72"
          />
          <button
            type="submit"
            className="whitespace-nowrap rounded-full bg-[#4f8cff] px-6 py-3.5 text-[15px] font-bold text-[#08101f] transition-colors hover:bg-[#6ea0ff]"
          >
            See it in action →
          </button>
        </form>
        <p className="mt-[18px] text-[13px] text-[#6d7178]">Live demo running on synthetic resort data — the engines are real.</p>
      </div>

      <div className="relative mt-20 grid grid-cols-1 gap-8 border-t border-white/10 px-6 py-14 sm:grid-cols-3 md:px-16">
        <div className="text-center sm:border-l-0 sm:px-6">
          <div className="text-4xl font-bold text-[#4f8cff]" style={{ fontFamily: "var(--font-display), sans-serif" }}>
            {revenueLift}
          </div>
          <div className="mt-2 text-sm text-[#9aa1a9]">Projected revenue lift vs. flat pricing</div>
        </div>
        <div className="border-white/10 text-center sm:border-l sm:px-6">
          <div className="text-4xl font-bold text-[#4f8cff]" style={{ fontFamily: "var(--font-display), sans-serif" }}>
            {sentiment.totalReviews}
          </div>
          <div className="mt-2 text-sm text-[#9aa1a9]">Guest reviews analyzed automatically</div>
        </div>
        <div className="border-white/10 text-center sm:border-l sm:px-6">
          <div className="text-4xl font-bold text-[#4f8cff]" style={{ fontFamily: "var(--font-display), sans-serif" }}>
            {ENGINE_COUNT}
          </div>
          <div className="mt-2 text-sm text-[#9aa1a9]">AI engines unified into one dashboard</div>
        </div>
      </div>
    </div>
  );
}
