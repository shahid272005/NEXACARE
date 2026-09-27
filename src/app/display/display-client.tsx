"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import NexaCareBrand from "@/components/nexacare-brand";

type CalledTicket = {
  id: string;
  token_number: string;
  called_at: string | null;
  department_name: string;
  location: string;
  room_label: string | null;
};
type Announcement = { id: string; title: string; body: string; language_code: string; priority: number };
type WaitingTicket = { id: string; token_number: string; estimated_wait_minutes: number; checked_in_at: string; department_name: string; department_code: string };

export default function DisplayClient() {
  const [called, setCalled] = useState<CalledTicket[]>([]);
  const [waiting, setWaiting] = useState<WaitingTicket[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [soundOn, setSoundOn] = useState(false);
  const [announcementLanguage, setAnnouncementLanguage] = useState<"en" | "hi" | "kn">("kn");
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState("");
  const knownIds = useRef<Set<string> | null>(null);
  const soundOnRef = useRef(false);

  const announce = useCallback((ticket: CalledTicket) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const room = ticket.room_label ?? ticket.location ?? "your consultation room";
    const text = announcementLanguage === "kn" ? `ಟೋಕನ್ ${ticket.token_number}. ದಯವಿಟ್ಟು ${room} ಗೆ ಹೋಗಿ.` : announcementLanguage === "hi" ? `टोकन ${ticket.token_number}. कृपया ${room} में जाएँ।` : `Token ${ticket.token_number}, please proceed to ${room}.`;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = announcementLanguage === "kn" ? "kn-IN" : announcementLanguage === "hi" ? "hi-IN" : "en-IN";
    utterance.rate = 0.85;
    window.speechSynthesis.speak(utterance);
  }, [announcementLanguage]);

  const refresh = useCallback(async () => {
    if (!supabase) { setNotice("Display is not connected. Check the local environment settings."); setReady(true); return; }
    const [ticketResult, waitingResult, announcementResult] = await Promise.all([
      supabase.from("public_queue_calls").select("id,token_number,called_at,department_name,location,room_label").order("called_at", { ascending: false }),
      supabase.from("public_waiting_queue").select("id,token_number,estimated_wait_minutes,checked_in_at,department_name,department_code").order("checked_in_at").limit(8),
      supabase.from("announcements").select("id,title,body,language_code,priority").eq("is_active", true).order("priority", { ascending: false }),
    ]);
    if (ticketResult.error || waitingResult.error || announcementResult.error) setNotice("Waiting for the live queue connection…");
    const nextCalled = (ticketResult.data ?? []) as unknown as CalledTicket[];
    const prior = knownIds.current;
    if (prior && soundOnRef.current) {
      const newlyCalled = nextCalled.find((ticket) => !prior.has(ticket.id));
      if (newlyCalled) announce(newlyCalled);
    }
    knownIds.current = new Set(nextCalled.map((ticket) => ticket.id));
    setCalled(nextCalled); setWaiting((waitingResult.data ?? []) as WaitingTicket[]); setAnnouncements((announcementResult.data ?? []) as Announcement[]); setReady(true);
  }, [announce]);

  useEffect(() => { queueMicrotask(() => { void refresh(); }); }, [refresh]);
  // The public screen reads a token-only database view. It polls that safe view so it
  // never needs permission to subscribe to full queue records.
  useEffect(() => {
    const interval = window.setInterval(() => { void refresh(); }, 5000);
    return () => { window.clearInterval(interval); };
  }, [refresh]);
  useEffect(() => {
    const client = supabase;
    if (!client) return;
    const channel = client.channel("public-display")
      .on("postgres_changes", { event: "*", schema: "public", table: "queue_tickets" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "announcements" }, refresh)
      .subscribe();
    return () => { client.removeChannel(channel); };
  }, [refresh]);

  function enableSound() {
    soundOnRef.current = !soundOn;
    setSoundOn(!soundOn);
    if (!soundOn) {
      setNotice("Voice announcements enabled.");
      if (called[0]) announce(called[0]);
    } else { window.speechSynthesis?.cancel(); setNotice("Voice announcements paused."); }
  }

  const featured = called[0];
  const information = announcements[0];

  return (
    <main className="min-h-screen bg-[#071a30] p-5 text-white lg:p-8">
      <div className="mx-auto flex min-h-[calc(100vh-2.5rem)] max-w-[1500px] flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-[#0c2642] shadow-2xl lg:min-h-[calc(100vh-4rem)]">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 px-7 py-5 lg:px-10"><NexaCareBrand inverse /><div className="flex flex-wrap items-center gap-3"><select aria-label="Announcement language" value={announcementLanguage} onChange={(event) => setAnnouncementLanguage(event.target.value as "en" | "hi" | "kn")} className="rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold text-white"><option value="kn" className="text-[#10233f]">ಕನ್ನಡ voice</option><option value="hi" className="text-[#10233f]">हिन्दी voice</option><option value="en" className="text-[#10233f]">English voice</option></select><span className="hidden rounded-full bg-[#123a54] px-3 py-1.5 text-xs font-semibold text-[#7de1d6] sm:block">● LIVE</span><button onClick={enableSound} className={`rounded-xl px-4 py-2 text-sm font-semibold ${soundOn ? "bg-[#54c7b9] text-[#062a32]" : "bg-white/10 text-white"}`}>{soundOn ? "🔊 Announcements on" : "🔇 Enable announcements"}</button></div></header>
        <section className="grid flex-1 gap-6 p-6 lg:grid-cols-[1.2fr_.8fr] lg:p-10">
          <div className="flex flex-col justify-center rounded-[2rem] bg-[#102f50] p-8 lg:p-12">
            <p className="text-base font-semibold uppercase tracking-[0.2em] text-[#7de1d6]">Now serving</p>
            {ready && featured ? <><p className="mt-6 text-7xl font-semibold tracking-tight sm:text-8xl lg:text-9xl">{featured.token_number}</p><div className="mt-8 max-w-2xl rounded-2xl border border-[#54c7b9]/30 bg-[#0d3852] p-6"><p className="text-xl font-semibold sm:text-2xl">{featured.department_name}</p><p className="mt-2 text-lg text-[#c4d6e4]">Please proceed to <span className="font-semibold text-[#fff1b5]">{featured.room_label ?? featured.location}</span></p></div><p className="mt-7 text-base text-[#a9c1d6]">कृपया अपने टोकन पर ध्यान दें · ದಯವಿಟ್ಟು ನಿಮ್ಮ ಟೋಕನ್ ಗಮನಿಸಿ</p></> : <><p className="mt-7 text-4xl font-semibold">{ready ? "No token is being called" : "Connecting to the queue…"}</p><p className="mt-5 text-[#a9c1d6]">Please wait for the next consultation call.</p></>}
          </div>
          <aside className="flex flex-col gap-6"><section className="rounded-[2rem] bg-[#f5c552] p-7 text-[#2b250d]"><p className="text-sm font-bold uppercase tracking-[0.16em] text-[#6e5816]">Hospital information</p><h2 className="mt-5 text-2xl font-semibold leading-tight">{information?.title ?? "Welcome to Demo Hospital"}</h2><p className="mt-4 text-lg leading-7 text-[#55461b]">{information?.body ?? "Please keep your token ready and follow staff guidance."}</p><p className="mt-7 text-sm font-semibold">Ask the help desk for assistance →</p></section><section className="flex-1 rounded-[2rem] border border-white/10 bg-white/5 p-7"><div className="flex items-center justify-between"><p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#7de1d6]">Waiting queue</p><span className="rounded-full bg-white/10 px-2 py-1 text-xs font-semibold">{waiting.length} shown</span></div><p className="mt-2 text-xs leading-5 text-[#a9c1d6]">Please arrive near your room before your estimated time.</p><div className="mt-4 space-y-2">{waiting.slice(0, 6).map((ticket) => <div key={ticket.id} className="flex items-center justify-between rounded-2xl bg-white/10 px-4 py-3"><div><p className="text-xl font-semibold">{ticket.token_number}</p><p className="mt-1 text-xs text-[#c4d6e4]">{ticket.department_name}</p></div><p className="rounded-xl bg-[#54c7b9] px-3 py-2 text-sm font-bold text-[#062a32]">~{ticket.estimated_wait_minutes} min</p></div>)}{waiting.length === 0 && <p className="rounded-2xl bg-white/5 p-4 text-sm text-[#a9c1d6]">No patients are waiting right now.</p>}</div></section></aside>
        </section>
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-7 py-4 text-sm text-[#a9c1d6] lg:px-10"><p>Please maintain a clear waiting area and listen for your token.</p><p>Need help? Visit reception.</p></footer>
      </div>
      {notice && <p role="status" className="fixed bottom-7 left-1/2 -translate-x-1/2 rounded-xl bg-white px-5 py-3 text-sm font-medium text-[#10233f] shadow-xl">{notice}</p>}
    </main>
  );
}
