"use client";

import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { BadgeCheck, CheckCircle2, MessageCircle, Phone, Share2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form";
import { NIGERIAN_PHONE, PHONE_MESSAGE } from "@/modules/auth/password-schema";
import { captchaEnabled, Turnstile } from "@/components/shared/turnstile";
import type { Listing } from "@/types/api";

const today = () => new Date().toISOString().slice(0, 10);

const schema = z.object({
  name: z.string().trim().min(2, "Enter your name.").max(100),
  phone: z.string().trim().regex(NIGERIAN_PHONE, PHONE_MESSAGE),
  email: z.union([z.literal(""), z.string().trim().email("Enter a valid email address.")]),
  message: z.string().trim().min(10, "Write at least 10 characters.").max(1000),
  preferred_viewing_date: z.union([z.literal(""), z.string().refine((v) => v >= today(), "Choose today or a later date.")]),
});
type Values = z.infer<typeof schema>;

/** Agent card + enquiry form (SCR-LIST-03). The agent's phone is revealed only on request and logged. */
export function EnquiryPanel({ listing }: { listing: Listing }) {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [revealing, setRevealing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const onToken = useCallback((t: string | null) => setCaptchaToken(t), []);

  const { register, handleSubmit, setError: setFieldError, formState: { errors, isSubmitting } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", phone: "+234", email: "", message: `I'm interested in ${listing.title}.`, preferred_viewing_date: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    if (captchaEnabled && !captchaToken) {
      setError("Please complete the security check.");
      return;
    }
    try {
      await api.post(`/public/listings/${listing.id}/enquiries`, {
        ...values,
        captcha_token: captchaToken,
        email: values.email || null,
        preferred_viewing_date: values.preferred_viewing_date || null,
      });
      setSent(true);
    } catch (e) {
      if (e instanceof ApiError) {
        Object.entries(e.fieldErrors()).forEach(([f, m]) => setFieldError(f as keyof Values, { message: m }));
        setError(e.status === 429 ? "Too many enquiries, try again later." : e.errors.length ? null : e.message);
      } else setError("Your enquiry could not be sent. Please try again.");
    }
  });

  const reveal = async () => {
    setRevealing(true);
    try {
      const res = await api.post<{ data: { phone: string | null } }>(`/public/listings/${listing.id}/contact-reveal`);
      setPhone(res.data.phone ?? "Not provided");
    } catch {
      setPhone("Unavailable — please send an enquiry");
    } finally {
      setRevealing(false);
    }
  };

  const shareUrl = typeof window !== "undefined" ? window.location.href : "";

  return (
    <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
      {listing.agent && (
        <div className="card p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-400">Listed by</p>
          <div className="mt-3 flex items-center gap-3">
            {listing.agent.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={listing.agent.avatarUrl} alt="" className="h-12 w-12 rounded-full object-cover" />
            ) : (
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-army-800 font-semibold text-white">{listing.agent.name.charAt(0)}</span>
            )}
            <div>
              <p className="flex items-center gap-1 font-semibold">
                {listing.agent.name}
                {listing.agent.verified && <BadgeCheck className="h-4 w-4 text-gold-500" aria-label="Verified agent" />}
              </p>
              {listing.agent.agencyName && <p className="text-sm text-ink-600">{listing.agent.agencyName}</p>}
            </div>
          </div>
          {phone ? (
            <a href={phone.startsWith("+") ? `tel:${phone}` : undefined} className="mt-4 flex h-10 items-center justify-center gap-2 rounded-lg border border-line text-sm font-medium">
              <Phone className="h-4 w-4" aria-hidden /> {phone}
            </a>
          ) : (
            <Button variant="outline" className="mt-4 w-full" onClick={reveal} loading={revealing}>
              <Phone className="h-4 w-4" /> Show phone number
            </Button>
          )}
        </div>
      )}

      <div className="card p-5">
        {sent ? (
          <div className="py-6 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-success-600" aria-hidden />
            <p className="mt-3 font-semibold">Your enquiry has been sent to the agent.</p>
            <p className="mt-1 text-sm text-ink-600">They will contact you on the phone number you provided.</p>
          </div>
        ) : (
          <form onSubmit={onSubmit} noValidate className="space-y-4">
            <h2 className="text-lg font-semibold">Send an enquiry</h2>
            {error && <p role="alert" className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-600">{error}</p>}
            <Field label="Full name" htmlFor="enq-name" error={errors.name?.message} required>
              <Input id="enq-name" autoComplete="name" aria-invalid={!!errors.name} {...register("name")} />
            </Field>
            <Field label="Phone" htmlFor="enq-phone" error={errors.phone?.message} required>
              <Input id="enq-phone" type="tel" autoComplete="tel" aria-invalid={!!errors.phone} {...register("phone")} />
            </Field>
            <Field label="Email" htmlFor="enq-email" error={errors.email?.message}>
              <Input id="enq-email" type="email" autoComplete="email" aria-invalid={!!errors.email} {...register("email")} />
            </Field>
            <Field label="Message" htmlFor="enq-message" error={errors.message?.message} required>
              <Textarea id="enq-message" rows={4} aria-invalid={!!errors.message} {...register("message")} />
            </Field>
            <Field label="Preferred viewing date" htmlFor="enq-date" error={errors.preferred_viewing_date?.message}>
              <Input id="enq-date" type="date" min={today()} {...register("preferred_viewing_date")} />
            </Field>
            <Turnstile onToken={onToken} />
            <Button type="submit" className="w-full" loading={isSubmitting}>Send enquiry</Button>
          </form>
        )}
      </div>

      <div className="flex gap-2">
        <Button
          variant="outline"
          className="flex-1"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(shareUrl);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {
              /* clipboard unavailable */
            }
          }}
        >
          <Share2 className="h-4 w-4" /> {copied ? "Link copied" : "Copy link"}
        </Button>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(`${listing.title} ${shareUrl}`)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg border border-line bg-white text-sm font-medium hover:bg-army-50"
        >
          <MessageCircle className="h-4 w-4" aria-hidden /> WhatsApp
        </a>
      </div>
    </aside>
  );
}
