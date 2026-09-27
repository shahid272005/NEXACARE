import NexaCareBrand from "@/components/nexacare-brand";

export default function Home() {
  const surfaces = [
    ["01", "Patient kiosk", "Register, choose a department, receive a token.", "/kiosk", "Open kiosk"],
    ["02", "Doctor workspace", "Call next, see only the operational queue.", "/doctor", "Open workspace"],
    ["03", "Public display", "Large, clear call-outs and accessible announcements.", "/display", "Open display"],
    ["04", "Operations", "Track flow, capacity, wait-time and outcomes.", "/admin", "Open dashboard"],
  ];

  return (
    <main className="min-h-screen overflow-hidden bg-[#f6f9fc] px-6 py-8 sm:px-10 lg:px-16">
      <nav className="mx-auto flex max-w-6xl items-center justify-between">
        <NexaCareBrand />
        <span className="rounded-full bg-[#e6f6f3] px-4 py-2 text-xs font-semibold text-[#087e8b]">Summit MVP · Demo mode</span>
      </nav>

      <section className="mx-auto grid max-w-6xl gap-10 pb-16 pt-20 lg:grid-cols-[1.1fr_.9fr] lg:items-center lg:pt-28">
        <div>
          <p className="mb-5 inline-flex rounded-full border border-[#bde5df] bg-white px-4 py-2 text-sm font-medium text-[#087e8b]">Hospital flow, made humane</p>
          <h1 className="max-w-3xl text-5xl font-semibold leading-[1.05] tracking-tight text-[#10233f] sm:text-6xl">Every patient knows <span className="text-[#087e8b]">what happens next.</span></h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-[#5d708a]">One live queue connects the self-service kiosk, doctors, public displays, and hospital operations—using safe, synthetic demo data.</p>
          <div className="mt-9 flex flex-wrap gap-3">
            <span className="rounded-xl bg-[#10233f] px-5 py-3 text-sm font-semibold text-white">P0: live queue workflow</span>
            <span className="rounded-xl border border-[#d8e1eb] bg-white px-5 py-3 text-sm font-semibold text-[#415671]">Privacy-first by design</span>
          </div>
        </div>

        <div className="rounded-3xl border border-white bg-white p-6 shadow-[0_24px_70px_rgba(16,35,63,0.12)]">
          <div className="flex items-center justify-between border-b border-[#e8eef4] pb-5">
            <div><p className="text-sm font-semibold text-[#10233f]">OPD today</p><p className="text-xs text-[#6f8199]">Demo Hospital · Ground Floor</p></div>
            <span className="rounded-full bg-[#e8f8ef] px-3 py-1 text-xs font-bold text-[#23834f]">● Live</span>
          </div>
          <div className="grid grid-cols-3 gap-3 py-6 text-center">
            <div><p className="text-2xl font-semibold text-[#10233f]">24</p><p className="text-xs text-[#6f8199]">in queue</p></div>
            <div><p className="text-2xl font-semibold text-[#10233f]">11 min</p><p className="text-xs text-[#6f8199]">avg. wait</p></div>
            <div><p className="text-2xl font-semibold text-[#10233f]">6</p><p className="text-xs text-[#6f8199]">doctors live</p></div>
          </div>
          <div className="rounded-2xl bg-[#effaf8] p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#087e8b]">Now serving · General Medicine</p>
            <div className="mt-2 flex items-end justify-between"><p className="text-4xl font-semibold text-[#10233f]">GM-042</p><p className="text-sm font-medium text-[#23834f]">Please proceed to Room 12</p></div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {surfaces.map(([number, title, copy, href, action]) => (
          <article key={number} className="rounded-2xl border border-[#dfe8f1] bg-white p-5">
            <p className="text-xs font-bold text-[#ef8354]">{number}</p><h2 className="mt-4 font-semibold text-[#10233f]">{title}</h2><p className="mt-2 text-sm leading-6 text-[#6f8199]">{copy}</p><a href={href} className="mt-5 inline-flex text-sm font-semibold text-[#087e8b] hover:text-[#056a75]">{action} →</a>
          </article>
        ))}
      </section>
    </main>
  );
}
