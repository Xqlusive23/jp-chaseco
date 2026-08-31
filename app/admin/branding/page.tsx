"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useBrand } from "../../components/BrandProvider";
import { useStoreSync } from "../../components/StoreProvider";
import { DEFAULT_BRAND, brandMark } from "../../lib/brand";
import { shrinkDataImage } from "../../lib/email-images";
import { DEFAULT_P2P_EMAIL, P2P_PLACEHOLDERS, normalizeP2pEmail, p2pTemplateBlocked } from "../../lib/p2p-template";
import { pushStore } from "../../lib/sync";

export default function AdminBrandingPage() {
  const { brand, setBrand } = useBrand();
  const { synced } = useStoreSync();
  const logoRef = useRef<HTMLInputElement>(null);
  const nameImageRef = useRef<HTMLInputElement>(null);
  const p2pNameImageRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(brand.name);
  const [logo, setLogo] = useState(brand.logo);
  const [nameImage, setNameImage] = useState(brand.nameImage);
  const [nameImageScale, setNameImageScale] = useState(brand.nameImageScale || 56);
  const [p2pEmail, setP2pEmail] = useState(normalizeP2pEmail(brand.p2pEmail));
  const [saved, setSaved] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(brand.name);
    setLogo(brand.logo);
    setNameImage(brand.nameImage);
    setNameImageScale(brand.nameImageScale || 56);
    setP2pEmail(normalizeP2pEmail(brand.p2pEmail));
  }, [brand]);

  function readFile(file: File | undefined, setter: (value: string) => void) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      void shrinkDataImage(String(reader.result ?? ""), 720).then(setter);
    };
    reader.readAsDataURL(file);
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSaved("");
    const nextP2p = normalizeP2pEmail(p2pEmail);
    const blocked = p2pTemplateBlocked(nextP2p);
    if (blocked) {
      setError(blocked);
      return;
    }
    setSaving(true);
    setBrand({
      name: name.trim() || DEFAULT_BRAND.name,
      logo,
      nameImage,
      nameImageScale,
      p2pEmail: nextP2p,
    });
    const result = await pushStore();
    setSaving(false);
    if (!result.ok) {
      setError(result.error || "Saved on this browser only. Add Upstash Redis in Vercel Marketplace to share the name image with other browsers.");
      return;
    }
    setSaved("Branding saved for every browser. Open the site on another device and refresh.");
  }

  async function handleReset() {
    setName(DEFAULT_BRAND.name);
    setLogo("");
    setNameImage("");
    setNameImageScale(DEFAULT_BRAND.nameImageScale);
    setP2pEmail(DEFAULT_P2P_EMAIL);
    setBrand(DEFAULT_BRAND);
    setError("");
    setSaving(true);
    const result = await pushStore();
    setSaving(false);
    if (!result.ok) {
      setError(result.error || "Reset on this browser only.");
      return;
    }
    setSaved("Reset to the default identity.");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="page-title">Branding</h1>
        <p className="page-sub">
          Use a name image in place of written text, or keep the name and place the logo on the right. Saved branding is shared with every device once the live store is connected.
        </p>
      </div>
      <form onSubmit={handleSave} className="panel space-y-4 p-6">
        <label className="block">
          <span className="mb-1 block text-sm text-[var(--muted)]">Website name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="field"
            placeholder="blueco or blueco Bank"
          />
          <p className="mt-1 text-sm text-[var(--muted)]">
            This is the name that replaces blueco Bank everywhere, including cards and Investments. If you enter blueco, pages will show blueco Bank.
          </p>
        </label>

        <div>
          <span className="mb-1 block text-sm text-[var(--muted)]">Name as image</span>
          <p className="mb-2 text-sm text-[var(--muted)]">Upload this if your website name is a graphic instead of words.</p>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => nameImageRef.current?.click()} className="btn-secondary">
              Upload name image
            </button>
            {nameImage && (
              <button type="button" onClick={() => setNameImage("")} className="text-sm font-semibold text-red-700">
                Use written name
              </button>
            )}
          </div>
          <input
            ref={nameImageRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => readFile(event.target.files?.[0], setNameImage)}
          />
          {nameImage && (
            <label className="mt-3 block">
              <span className="mb-1 block text-sm text-[var(--muted)]">Name image size: {nameImageScale}px</span>
              <input
                type="range"
                min={32}
                max={120}
                value={nameImageScale}
                onChange={(event) => setNameImageScale(Number(event.target.value))}
                className="w-full"
              />
            </label>
          )}
        </div>

        <div>
          <span className="mb-1 block text-sm text-[var(--muted)]">Logo</span>
          <p className="mb-2 text-sm text-[var(--muted)]">This mark stays on the right of the name. If you skip it, the name image is used as the browser and home-screen icon.</p>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => logoRef.current?.click()} className="btn-secondary">
              Upload logo
            </button>
            {logo && (
              <button type="button" onClick={() => setLogo("")} className="text-sm font-semibold text-red-700">
                Remove logo
              </button>
            )}
          </div>
          <input
            ref={logoRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => readFile(event.target.files?.[0], setLogo)}
          />
        </div>

        <div className="space-y-3 border-t border-[var(--line)] pt-4">
          <div>
            <h2 className="text-lg font-semibold text-[var(--navy)]">Zelle email</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Change the wording, header color, and name image for payment-received mail. Use placeholders: {P2P_PLACEHOLDERS.join(", ")}.
            </p>
          </div>
          <div>
            <span className="mb-1 block text-sm text-[var(--muted)]">Zelle name image</span>
            <p className="mb-2 text-sm text-[var(--muted)]">
              This graphic replaces the default website name image on Zelle emails only.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={() => p2pNameImageRef.current?.click()} className="btn-secondary">
                Upload Zelle name image
              </button>
              {p2pEmail.nameImage && (
                <button type="button" onClick={() => setP2pEmail({ ...p2pEmail, nameImage: "" })} className="text-sm font-semibold text-red-700">
                  Use default name image
                </button>
              )}
            </div>
            <input
              ref={p2pNameImageRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => readFile(event.target.files?.[0], (value) => setP2pEmail({ ...p2pEmail, nameImage: value }))}
            />
            <div className="mt-3 rounded-lg px-4 py-3 text-center" style={{ backgroundColor: p2pEmail.headerColor }}>
              <p className="mb-2 text-[15px] font-extrabold uppercase tracking-[0.16em] text-white">
                {p2pEmail.eyebrow || "You received money"}
              </p>
              {p2pEmail.nameImage || nameImage ? (
                <img
                  src={p2pEmail.nameImage || nameImage}
                  alt=""
                  className={`mx-auto h-10 w-auto max-w-[200px] object-contain ${p2pEmail.nameImage ? "" : "brightness-0 invert"}`}
                />
              ) : (
                <p className="text-lg font-semibold text-white">{name || DEFAULT_BRAND.name}</p>
              )}
              <p className="mt-2 text-xs font-bold uppercase tracking-[0.16em] text-white">
                {p2pEmail.nameImage ? "Zelle name image" : "Default name image"}
              </p>
            </div>
          </div>
          <label className="block">
            <span className="mb-1 block text-sm text-[var(--muted)]">Subject</span>
            <input
              value={p2pEmail.subject}
              onChange={(event) => setP2pEmail({ ...p2pEmail, subject: event.target.value })}
              className="field"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-[var(--muted)]">Header label</span>
            <input
              value={p2pEmail.eyebrow}
              onChange={(event) => setP2pEmail({ ...p2pEmail, eyebrow: event.target.value })}
              className="field"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-[var(--muted)]">Header color</span>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={p2pEmail.headerColor}
                onChange={(event) => setP2pEmail({ ...p2pEmail, headerColor: event.target.value })}
                className="h-10 w-14 cursor-pointer rounded border border-[var(--line)] bg-white p-1"
              />
              <input
                value={p2pEmail.headerColor}
                onChange={(event) => setP2pEmail({ ...p2pEmail, headerColor: event.target.value })}
                className="field"
              />
            </div>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-[var(--muted)]">Opening lines</span>
            <textarea
              value={p2pEmail.intro}
              onChange={(event) => setP2pEmail({ ...p2pEmail, intro: event.target.value })}
              rows={3}
              className="field min-h-[88px]"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-[var(--muted)]">Line above the amount</span>
            <input
              value={p2pEmail.amountLine}
              onChange={(event) => setP2pEmail({ ...p2pEmail, amountLine: event.target.value })}
              className="field"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-[var(--muted)]">Description above Contact us</span>
            <textarea
              value={p2pEmail.contactNote}
              onChange={(event) => setP2pEmail({ ...p2pEmail, contactNote: event.target.value })}
              rows={3}
              className="field min-h-[88px]"
              placeholder="Shown just above the Contact us button"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-[var(--muted)]">Footer</span>
            <textarea
              value={p2pEmail.footer}
              onChange={(event) => setP2pEmail({ ...p2pEmail, footer: event.target.value })}
              rows={3}
              className="field min-h-[88px]"
            />
          </label>
          <button type="button" onClick={() => setP2pEmail(DEFAULT_P2P_EMAIL)} className="text-sm font-semibold text-[var(--blue)]">
            Reset Zelle email
          </button>
        </div>

        <div className="rounded-xl bg-[var(--page)] p-4">
          <p className="mb-3 text-sm text-[var(--muted)]">Preview</p>
          <div className="flex items-center justify-between rounded-lg bg-[var(--navy)] px-4 py-3">
            <div className="inline-flex items-center gap-3 text-white">
              {nameImage ? (
                <img
                  src={nameImage}
                  alt=""
                  style={{ height: nameImageScale, maxWidth: nameImageScale * 6 }}
                  className="w-auto object-contain brightness-0 invert"
                />
              ) : (
                <span className="text-lg font-semibold">{name || DEFAULT_BRAND.name}</span>
              )}
              {(logo || !nameImage) &&
                (logo ? (
                  <img src={logo} alt="" className="h-8 w-auto max-w-[72px] object-contain" />
                ) : (
                  <span className="flex h-8 w-8 items-center justify-center rounded-md bg-white text-sm font-bold text-[#0b1f3a]">
                    {brandMark(name || DEFAULT_BRAND.name)}
                  </span>
                ))}
            </div>
            <span className="text-sm text-white/70">Receipt</span>
          </div>
        </div>
        {synced === false && (
          <p className="text-sm text-amber-800">
            Other browsers will not see this name image until you add Upstash Redis from the Vercel Marketplace and redeploy.
          </p>
        )}
        {error && <p className="text-sm text-red-700">{error}</p>}
        {saved && <p className="text-sm text-[var(--blue)]">{saved}</p>}
        <div className="flex flex-wrap gap-2">
          <button disabled={saving} className="btn-primary">
            {saving ? "Saving…" : "Save branding"}
          </button>
          <button type="button" onClick={handleReset} className="btn-secondary">
            Reset default
          </button>
        </div>
      </form>
    </div>
  );
}
