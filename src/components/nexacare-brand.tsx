import Image from "next/image";

export default function NexaCareBrand({ inverse = false }: { inverse?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="nexa-logo-glow relative grid h-14 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-white p-1.5">
        <Image src="/brand/nexacare-dna.jpeg" alt="NexaCare DNA emblem" fill sizes="64px" className="object-contain p-1" priority />
      </div>
      <div>
        <p className={`text-xl font-extrabold tracking-[-.04em] ${inverse ? "text-white" : "text-[#10233f]"}`}>Nexa<span className="text-[#42bfa5]">Care</span></p>
        <p className={`text-[11px] font-semibold tracking-wide ${inverse ? "text-[#b8d4d9]" : "text-[#71849a]"}`}>ADVANCED HEALTHCARE SOLUTIONS</p>
      </div>
    </div>
  );
}
