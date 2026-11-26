"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { ShieldCheck, ShieldOff } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/modules/auth/auth-provider";

/**
 * Two-factor sign-in with an authenticator app (TOTP, FR-AUTH-12). Mandatory for administrators and
 * finance staff in production; optional for everyone else.
 */
export default function AccountSecurityPage() {
  const { session, refresh } = useAuth();
  const toast = useToast();
  const required = useSearchParams().get("required") === "1" || session?.mfaSetupRequired;
  const [setup, setSetup] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [recovery, setRecovery] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const call = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof ApiError ? (Object.values(e.fieldErrors())[0] ?? e.message) : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const start = () => call(async () => setSetup((await api.post<{ data: { secret: string; otpauthUrl: string } }>("/auth/mfa/setup")).data));
  const enable = () => call(async () => {
    const res = await api.post<{ data: { recoveryCodes: string[] } }>("/auth/mfa/enable", { code: code.trim() });
    setRecovery(res.data.recoveryCodes);
    setSetup(null);
    setCode("");
    refresh();
    toast.success("Two-factor sign-in is now on.");
  });
  const disable = () => call(async () => {
    await api.post("/auth/mfa/disable", { password });
    setPassword("");
    refresh();
    toast.success("Two-factor sign-in was turned off.");
  });

  if (!session) return null;

  return (
    <>
      <PageHeader title="Sign-in security" breadcrumbs={[{ label: "Account" }, { label: "Sign-in security" }]} />
      {required && !session.mfaEnabled && (
        <div role="alert" className="mb-6 rounded-lg border border-warning-600/30 bg-warning-50 p-4 text-sm text-warning-600">
          Your role must use two-factor sign-in. Set it up below to continue to your portal.
        </div>
      )}
      <Card className="max-w-2xl">
        <CardHeader title="Two-factor sign-in" description="After your password, you also enter a 6-digit code from an authenticator app such as Google Authenticator or Microsoft Authenticator." />
        <div className="space-y-4 p-5">
          {error && <p role="alert" className="text-sm text-danger-600">{error}</p>}

          {recovery && (
            <div className="rounded-lg border border-gold-500/40 bg-gold-100 p-4">
              <p className="font-semibold">Save your recovery codes</p>
              <p className="mt-1 text-sm">Each code works once if you lose your phone. They will not be shown again.</p>
              <ul className="mt-3 grid grid-cols-2 gap-2 font-mono text-sm">{recovery.map((c) => <li key={c}>{c}</li>)}</ul>
              <Button className="mt-3" size="sm" variant="outline" onClick={() => setRecovery(null)}>I have saved them</Button>
            </div>
          )}

          {session.mfaEnabled ? (
            <>
              <p className="flex items-center gap-2 font-medium text-success-600"><ShieldCheck className="h-5 w-5" /> Two-factor sign-in is on.</p>
              {!session.mfaSetupRequired && (
                <div className="space-y-3 border-t border-line pt-4">
                  <Field label="Confirm your password to turn it off" htmlFor="mfa-pass">
                    <Input id="mfa-pass" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
                  </Field>
                  <Button variant="outline" onClick={disable} loading={busy} disabled={!password}><ShieldOff className="h-4 w-4" /> Turn off</Button>
                </div>
              )}
            </>
          ) : setup ? (
            <ol className="list-decimal space-y-4 pl-5 text-sm">
              <li>
                In your authenticator app choose <strong>Add account → Enter a setup key</strong> and type this key:
                <p className="mt-2 select-all rounded-lg bg-canvas px-3 py-2 font-mono text-base tracking-wider">{setup.secret}</p>
                <p className="mt-1 text-xs text-ink-600">On a phone you can also <a className="text-army-800 underline" href={setup.otpauthUrl}>open the setup link</a>.</p>
              </li>
              <li>
                Enter the 6-digit code the app shows:
                <div className="mt-2 flex gap-2">
                  <Input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} aria-label="Authentication code" className="max-w-40 font-mono" />
                  <Button onClick={enable} loading={busy} disabled={code.trim().length !== 6}>Turn on</Button>
                </div>
              </li>
            </ol>
          ) : (
            <Button onClick={start} loading={busy}><ShieldCheck className="h-4 w-4" /> Set up two-factor sign-in</Button>
          )}
        </div>
      </Card>
    </>
  );
}
