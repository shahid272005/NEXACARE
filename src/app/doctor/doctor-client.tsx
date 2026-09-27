"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Doctor = { id: string; display_name: string; room_label: string; department_id: string; is_available: boolean; departments: { name: string; location: string } | { name: string; location: string }[] };
type Ticket = { id: string; token_number: string; patient_label: string; patient_age_years: number | null; patient_weight_kg: number | null; status: "waiting" | "called" | "in_consultation" | "completed" | "skipped"; estimated_wait_minutes: number; doctor_id: string | null };

function first<T>(value: T | T[]) { return Array.isArray(value) ? value[0] : value; }
function profileLine(ticket: Ticket) { return [ticket.patient_age_years === null ? "Age not available" : `${ticket.patient_age_years} years`, ticket.patient_weight_kg === null ? "Weight not recorded" : `${ticket.patient_weight_kg} kg`].join(" · "); }

function PatientProfile({ ticket, featured = false }: { ticket: Ticket; featured?: boolean }) {
  return <div className={featured ? "mt-7 rounded-2xl bg-white/10 p-5" : "min-w-0"}>
    <p className={featured ? "text-2xl font-semibold" : "truncate font-semibold text-[#10233f]"}>{ticket.patient_label}</p>
    <p className={featured ? "mt-2 text-sm text-[#b8d4d9]" : "mt-1 text-sm text-[#60748c]"}>{profileLine(ticket)}</p>
    {featured && <p className="mt-3 text-xs leading-5 text-[#b8d4d9]">Private registration profile · not shown on the ward display</p>}
  </div>;
}

export default function DoctorClient() {
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [userId, setUserId] = useState<string | null>(null);
  const [doctor, setDoctor] = useState<Doctor | null>(null); const [tickets, setTickets] = useState<Ticket[]>([]); const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  const department = doctor ? first(doctor.departments) : null;
  const current = doctor ? tickets.find((ticket) => ticket.doctor_id === doctor.id && (ticket.status === "called" || ticket.status === "in_consultation")) : undefined;
  const waiting = tickets.filter((ticket) => ticket.status === "waiting" && ticket.doctor_id === null);

  const load = useCallback(async (id?: string) => {
    if (!supabase) { setMessage("Workspace is not connected. Check .env.local."); setLoading(false); return; }
    // getSession restores the persisted browser session locally on reload. getUser
    // can briefly fail while a token refresh is in flight and wrongly show sign-in.
    const currentUser = id ?? (await supabase.auth.getSession()).data.session?.user.id;
    setUserId(currentUser ?? null);
    if (!currentUser) { setLoading(false); return; }
    const { data: profile } = await supabase.from("doctor_profiles").select("doctor_id").eq("user_id", currentUser).maybeSingle();
    if (!profile) { setMessage("This account is not assigned to a doctor workspace."); setLoading(false); return; }
    const { data: doctorData, error: doctorError } = await supabase.from("doctors").select("id,display_name,room_label,department_id,is_available,departments(name,location)").eq("id", profile.doctor_id).single();
    if (doctorError || !doctorData) { setMessage("Doctor profile could not be loaded."); setLoading(false); return; }
    const activeDoctor = doctorData as unknown as Doctor;
    const { data: ticketData, error: ticketError } = await supabase.from("queue_tickets").select("id,token_number,patient_label,patient_age_years,patient_weight_kg,status,estimated_wait_minutes,doctor_id").eq("department_id", activeDoctor.department_id).order("checked_in_at");
    if (ticketError) setMessage("Could not load the private queue. Please refresh.");
    setDoctor(activeDoctor); setTickets((ticketData ?? []) as Ticket[]); setLoading(false);
  }, []);

  useEffect(() => { queueMicrotask(() => { void load(); }); }, [load]);
  useEffect(() => {
    const client = supabase;
    if (!client) return;
    const { data: listener } = client.auth.onAuthStateChange((_event, session) => {
      if (session?.user) void load(session.user.id);
    });
    return () => { listener.subscription.unsubscribe(); };
  }, [load]);
  useEffect(() => { const client = supabase; if (!client || !userId) return; const channel = client.channel("doctor-private-queue").on("postgres_changes", { event: "*", schema: "public", table: "queue_tickets" }, () => { void load(userId); }).subscribe(); return () => { client.removeChannel(channel); }; }, [load, userId]);
  async function signIn(event: FormEvent) { event.preventDefault(); if (!supabase) return; setBusy(true); setMessage(""); const { data, error } = await supabase.auth.signInWithPassword({ email, password }); if (error || !data.user) { setBusy(false); return setMessage("Sign-in failed. Check your email and password."); } const { data: profile } = await supabase.from("doctor_profiles").select("doctor_id").eq("user_id", data.user.id).maybeSingle(); if (profile) await supabase.rpc("start_doctor_shift", { p_doctor_id: profile.doctor_id }); setBusy(false); setLoading(true); void load(data.user.id); }
  async function signOut() { if (!supabase) return; if (doctor) await supabase.rpc("end_doctor_shift", { p_doctor_id: doctor.id }); await supabase.auth.signOut(); setDoctor(null); setTickets([]); setUserId(null); setMessage(""); }
  async function callNext() { if (!supabase || !doctor) return; setBusy(true); const { error } = await supabase.rpc("call_next_demo_ticket", { p_doctor_id: doctor.id }); setBusy(false); setMessage(error ? error.message : "Token called. The public display has updated."); if (!error) void load(userId ?? undefined); }
  async function completeAndCall() { if (!supabase || !doctor) return; setBusy(true); const { error: completeError } = await supabase.rpc("complete_demo_ticket", { p_doctor_id: doctor.id }); if (completeError) { setBusy(false); setMessage(completeError.message); return; } const { error: callError } = await supabase.rpc("call_next_demo_ticket", { p_doctor_id: doctor.id }); setBusy(false); setMessage(callError ? "Consultation completed. There is no next token to call." : "Consultation completed and next token called."); void load(userId ?? undefined); }
  async function toggleAvailability() { if (!supabase || !doctor) return; setBusy(true); const { error } = await supabase.rpc("set_doctor_availability", { p_doctor_id: doctor.id, p_available: !doctor.is_available }); setBusy(false); setMessage(error ? "Could not update availability." : doctor.is_available ? "You are unavailable until you return." : "You are available for consultation."); void load(userId ?? undefined); }

  if (loading) return <main className="grid min-h-screen place-items-center bg-[#f4f7fb] text-[#60748c]">Opening secure workspace…</main>;
  if (!userId) return <main className="grid min-h-screen place-items-center bg-[#edf6f7] p-5"><form onSubmit={signIn} className="w-full max-w-md rounded-3xl bg-white p-8 shadow-[0_24px_70px_rgba(16,35,63,.14)]"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#10233f] text-2xl font-bold text-white">+</span><p className="mt-6 text-sm font-bold uppercase tracking-[.15em] text-[#087e8b]">Private workspace</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#10233f]">Doctor sign in</h1><p className="mt-3 leading-6 text-[#60748c]">Use the account assigned by the hospital administrator.</p><label className="mt-7 block text-sm font-semibold">Email<input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-2 w-full rounded-xl border border-[#cfdde7] px-4 py-3 font-normal outline-none focus:border-[#087e8b]" /></label><label className="mt-4 block text-sm font-semibold">Password<input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-2 w-full rounded-xl border border-[#cfdde7] px-4 py-3 font-normal outline-none focus:border-[#087e8b]" /></label><button disabled={busy} className="mt-7 w-full rounded-xl bg-[#10233f] px-5 py-4 font-semibold text-white disabled:opacity-60">{busy ? "Signing in…" : "Sign in to workspace"}</button>{message && <p role="alert" className="mt-5 rounded-xl bg-[#fff0ee] p-3 text-sm text-[#b3432a]">{message}</p>}</form></main>;
  if (!doctor) return <main className="grid min-h-screen place-items-center bg-[#f4f7fb] p-6"><div className="max-w-lg rounded-3xl bg-white p-8 text-center shadow-lg"><h1 className="text-2xl font-semibold">Account needs assignment</h1><p className="mt-4 leading-7 text-[#60748c]">{message || "Ask the hospital administrator to link this account to your doctor profile."}</p><button onClick={signOut} className="mt-7 rounded-xl bg-[#10233f] px-5 py-3 font-semibold text-white">Sign out</button></div></main>;

  return <main className="min-h-screen bg-[#f4f7fb] text-[#10233f]"><header className="border-b border-[#dfe7ef] bg-white px-6 py-5 sm:px-10"><div className="mx-auto flex max-w-6xl items-center justify-between"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#10233f] text-xl font-bold text-white">+</span><div><p className="font-semibold">SmartCare Queue</p><p className="text-xs text-[#71849a]">Private doctor workspace</p></div></div><button onClick={signOut} className="text-sm font-semibold text-[#087e8b]">Sign out</button></div></header><section className="mx-auto max-w-6xl px-6 py-8 sm:px-10"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-[.15em] text-[#087e8b]">{department?.name}</p><h1 className="mt-2 text-3xl font-semibold">Hello, {doctor.display_name}</h1><p className="mt-2 text-[#60748c]">{doctor.room_label} · Private, minimum-necessary patient information.</p></div><button disabled={busy} onClick={toggleAvailability} className={`rounded-full px-4 py-2 text-sm font-semibold ${doctor.is_available ? "bg-[#e7f7ed] text-[#23834f]" : "bg-[#eef1f5] text-[#60748c]"}`}>{doctor.is_available ? "● Available" : "● Unavailable"}</button></div><div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_.9fr]"><article className="rounded-3xl bg-[#10233f] p-8 text-white"><p className="text-sm font-semibold uppercase tracking-[.16em] text-[#7de1d6]">{current ? "Now serving" : "Ready when you are"}</p>{current ? <><p className="mt-5 text-7xl font-semibold">{current.token_number}</p><PatientProfile ticket={current} featured /><p className="mt-5 text-sm text-[#b8d4d9]">The public screen sees only the token and room.</p><button disabled={busy} onClick={completeAndCall} className="mt-8 w-full rounded-2xl bg-[#f1c453] px-5 py-5 text-lg font-semibold text-[#30240a]">{busy ? "Updating…" : "Complete & call next"}</button></> : <><p className="mt-5 text-3xl font-semibold">No patient is currently called.</p><p className="mt-4 text-[#b8d4d9]">Call the next waiting token when you are ready.</p><button disabled={busy || !doctor.is_available} onClick={callNext} className="mt-8 w-full rounded-2xl bg-[#54c7b9] px-5 py-5 text-lg font-semibold text-[#07363b]">{busy ? "Calling…" : "Call next patient"}</button></>}</article><article className="rounded-3xl border border-[#dfe7ef] bg-white p-7"><div className="flex items-center justify-between"><div><h2 className="text-lg font-semibold">Your waiting queue</h2><p className="mt-1 text-sm text-[#71849a]">Private registration profile · never shown publicly</p></div><span className="rounded-full bg-[#effaf8] px-3 py-1 text-sm font-semibold text-[#087e8b]">{waiting.length} waiting</span></div><div className="mt-6 space-y-3">{waiting.slice(0, 8).map((item, index) => <div key={item.id} className="flex items-center justify-between gap-4 rounded-2xl border border-[#edf1f5] bg-[#f9fbfc] px-4 py-4"><div className="flex min-w-0 items-center gap-4"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-sm font-semibold text-[#60748c]">{index + 1}</span><div><p className="text-sm font-bold text-[#087e8b]">{item.token_number}</p><PatientProfile ticket={item} /></div></div><p className="shrink-0 rounded-xl bg-[#effaf8] px-3 py-2 text-sm font-semibold text-[#087e8b]">~{item.estimated_wait_minutes} min</p></div>)}{waiting.length === 0 && <p className="rounded-2xl bg-[#f6f9fc] p-5 text-sm text-[#60748c]">No patients are waiting right now.</p>}</div></article></div>{message && <p role="status" className="mt-6 rounded-xl bg-[#eaf7f5] px-5 py-4 text-sm font-medium text-[#087e8b]">{message}</p>}</section></main>;
}
