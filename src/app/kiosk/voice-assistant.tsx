"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Route = { kind: "emergency" } | { kind: "department"; department: "General Medicine" | "Orthopaedics" | "Paediatrics" };

type SpeechRecognitionInstance = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: { [index: number]: { [index: number]: { transcript: string } } }; resultIndex: number }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

const redFlags = [
  "chest pain", "chest pressure", "cannot breathe", "can not breathe", "difficulty breathing",
  "shortness of breath", "unconscious", "fainting", "heavy bleeding", "severe bleeding",
  "seizure", "fits", "poison", "accident", "stroke", "suicide",
  "ಎದೆ ನೋವು", "ಉಸಿರಾಟ ತೊಂದರೆ", "ಪ್ರಜ್ಞೆ ಇಲ್ಲ", "ಹೆಚ್ಚು ರಕ್ತಸ್ರಾವ", "ಅಪಘಾತ",
  "सीने में दर्द", "सांस लेने में तकलीफ", "बेहोश", "बहुत खून", "दुर्घटना",
];

function routeConcern(text: string): Route {
  const concern = text.toLowerCase();
  if (redFlags.some((flag) => concern.includes(flag))) return { kind: "emergency" };
  if (/bone|joint|knee|back pain|leg pain|arm pain|fracture|fall|injury|swelling|ಹಡ್ಡ|ಮೊಣಕಾಲ|ಬೆನ್ನು ನೋವು|ಗಾಯ|ಎಲುಬು|हड्ड|घुटन|पीठ दर्द|चोट/.test(concern)) return { kind: "department", department: "Orthopaedics" };
  if (/child|baby|infant|son|daughter|kid|ಮಗು|ಮಕ್ಕಳ|बच्च|शिशु/.test(concern)) return { kind: "department", department: "Paediatrics" };
  return { kind: "department", department: "General Medicine" };
}

export default function VoiceAssistant({ language, onRoute, onClose }: { language: "en" | "hi" | "kn"; onRoute: (route: Route) => void; onClose: () => void }) {
  const [supported, setSupported] = useState(true);
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState("");
  const [route, setRoute] = useState<Route | null>(null);
  const recognition = useRef<SpeechRecognitionInstance | null>(null);
  const languageCode = language === "kn" ? "kn-IN" : language === "hi" ? "hi-IN" : "en-IN";

  const speak = useCallback((text: string) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = languageCode;
    utterance.rate = 0.82;
    window.speechSynthesis.speak(utterance);
  }, [languageCode]);

  useEffect(() => {
    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Recognition) { queueMicrotask(() => setSupported(false)); return; }
    const instance = new Recognition();
    instance.lang = languageCode;
    instance.continuous = false;
    instance.interimResults = false;
    instance.onresult = (event) => {
      const transcript = event.results[event.resultIndex][0].transcript.trim();
      setHeard(transcript);
      const nextRoute = routeConcern(transcript);
      setRoute(nextRoute);
      setListening(false);
      if (nextRoute.kind === "emergency") speak("This may need urgent attention. Please go directly to the casualty or emergency desk now. Do not wait for OPD registration.");
      else speak(`I can help you register at ${nextRoute.department}. This is only a service suggestion, not a diagnosis. Would you like to continue?`);
    };
    instance.onerror = () => { setListening(false); };
    instance.onend = () => { setListening(false); };
    recognition.current = instance;
    speak("Tell me in your own words why you came to the hospital. For example, I have knee pain, or my child has fever.");
    return () => { instance.stop(); window.speechSynthesis?.cancel(); };
  }, [languageCode, speak]);

  function startListening() {
    if (!recognition.current) return;
    setHeard(""); setRoute(null); setListening(true);
    recognition.current.start();
  }

  return <div role="dialog" aria-modal="true" aria-label="Voice help assistant" className="fixed inset-0 z-50 grid place-items-center bg-[radial-gradient(circle_at_center,rgba(77,211,193,.24),rgba(6,24,43,.94)_55%)] p-4"><section className="w-full max-w-xl overflow-hidden rounded-[2rem] border border-white/50 bg-white/95 p-7 text-[#10233f] shadow-2xl backdrop-blur sm:p-9"><div className="flex items-start justify-between gap-5"><div><p className="text-sm font-bold uppercase tracking-[.15em] text-[#087e8b]">NexaCare voice help</p><h2 className="mt-2 text-3xl font-semibold tracking-tight">Tell me what you need.</h2></div><button onClick={onClose} className="rounded-xl bg-[#f1f5f7] px-3 py-2 text-sm font-semibold">Close</button></div><p className="mt-4 leading-7 text-[#60748c]">You may speak in Kannada, Hindi, or English. This assistant helps choose a hospital service; it does not diagnose or provide treatment.</p>{!supported ? <div className="mt-7 rounded-2xl bg-[#fff0ee] p-5 text-[#a33a27]"><p className="font-semibold">Voice input is unavailable in this browser.</p><p className="mt-2 text-sm">Please use a kiosk with Chrome or ask the help-desk volunteer.</p></div> : <><button onClick={startListening} disabled={listening} className={`mt-7 w-full rounded-3xl px-6 py-8 text-lg font-semibold transition ${listening ? "bg-[radial-gradient(circle,#d8f3ef,#b6e5df)] text-[#087e8b]" : "bg-[#087e8b] text-white hover:bg-[#066d79]"}`}><span className="relative mx-auto grid h-32 w-32 place-items-center">{listening && <><i className="voice-orbit absolute h-32 w-32 rounded-full bg-[#39c6b2]/15" /><i className="voice-orbit absolute h-24 w-24 rounded-full bg-[#39c6b2]/25" /><i className="voice-orbit absolute h-16 w-16 rounded-full bg-[#39c6b2]/35" /></>}<b className={`voice-core relative z-10 grid h-14 w-14 place-items-center rounded-full text-3xl ${listening ? "bg-[#087e8b] text-white shadow-[0_0_34px_rgba(8,126,139,.7)]" : "bg-white/15"}`}>{listening ? "◉" : "🎙️"}</b></span><span aria-live="polite" className="mt-3 block">{listening ? "Listening… please speak" : "Tap and tell me your problem"}</span></button><p className="mt-4 text-center text-xs text-[#71849a]">Do not say Aadhaar, ABHA, BPL, card, or payment numbers aloud.</p>{heard && <div className="mt-6 rounded-2xl bg-[#f6f9fc] p-5"><p className="text-xs font-bold uppercase tracking-[.12em] text-[#71849a]">I heard</p><p className="mt-2 font-medium">“{heard}”</p></div>}{route?.kind === "emergency" && <div className="mt-6 rounded-2xl bg-[#fff0ee] p-5"><p className="text-lg font-semibold text-[#a33a27]">Go directly to casualty / emergency now</p><p className="mt-2 text-sm leading-6 text-[#7b3c31]">Do not wait for an OPD token. Ask the nearest staff member for immediate help.</p><button onClick={() => onRoute(route)} className="mt-5 w-full rounded-xl bg-[#b3432a] px-5 py-3 font-semibold text-white">I understand</button></div>}{route?.kind === "department" && <div className="mt-6 rounded-2xl bg-[#effaf8] p-5"><p className="text-sm font-bold uppercase tracking-[.12em] text-[#087e8b]">Service suggestion</p><p className="mt-2 text-2xl font-semibold">{route.department}</p><p className="mt-2 text-sm leading-6 text-[#42676c]">This is a navigation suggestion only. A clinician will assess the patient.</p><button onClick={() => onRoute(route)} className="mt-5 w-full rounded-xl bg-[#087e8b] px-5 py-3 font-semibold text-white">Yes, continue to registration</button><button onClick={startListening} className="mt-3 w-full rounded-xl px-5 py-3 text-sm font-semibold text-[#087e8b]">Speak again</button></div>}</>}</section></div>;
}
