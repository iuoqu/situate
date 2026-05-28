"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Three sign-in paths under one form:
 *
 *   - Magic link · email only (default). Hits /api/auth/request-login.
 *     If the email is registered → Supabase mails a one-time link.
 *     If not → server returns `needs_invite` and we surface an invite
 *     code field.
 *
 *   - Magic link · email + invite code. Hits /api/auth/invite.
 *     Validates the code, calls the admin SDK to create the user, sends
 *     the invite email.
 *
 *   - Password. Email + password. Hits /api/auth/password-login.
 *     Cookie session set server-side; we then router.push to `next`.
 *     If the user has never set a password we surface a hint that
 *     points them at magic link + /auth/set-password.
 *
 * The Magic link / Password tabs are the top-level toggle. Within
 * Magic link, the email → invite-code transition is automatic.
 */

type Method = "magic" | "password";
type MagicMode = "email" | "invite";

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [method, setMethod] = useState<Method>("magic");
  const [magicMode, setMagicMode] = useState<MagicMode>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submitMagicEmail(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/request-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), next }),
      });
      const data = (await res.json()) as
        | { status: "sent" }
        | { status: "needs_invite" }
        | { error: string };
      if ("error" in data) {
        setError(data.error);
      } else if (data.status === "sent") {
        setSent(true);
      } else if (data.status === "needs_invite") {
        setMagicMode("invite");
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitMagicInvite(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          code: code.trim().toUpperCase(),
          next,
        }),
      });
      const data = (await res.json()) as
        | { status: "sent" }
        | { error: string; reason?: string };
      if ("error" in data) {
        setError(humanError(data));
      } else {
        setSent(true);
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/password-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password, next }),
      });
      const data = (await res.json()) as
        | { status: "ok"; next: string }
        | { error: string; reason?: string };
      if ("error" in data) {
        setError(data.error);
      } else {
        // Cookies are set by the server route; router.refresh() picks
        // them up before navigation so server components see the new
        // session on the destination page.
        router.refresh();
        router.push(data.next || "/");
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <section style={panelStyle}>
        <h2 style={panelTitleStyle}>Check your inbox.</h2>
        <p style={panelBodyStyle}>
          We sent a one-time sign-in link to <strong>{email}</strong>. It
          works for an hour, then expires. If it doesn&rsquo;t arrive in a
          minute or two, check your spam folder.
        </p>
        <p style={panelHintStyle}>
          Once you&rsquo;re in, visit{" "}
          <a href="/auth/set-password" style={inlineLinkStyle}>
            /auth/set-password
          </a>{" "}
          to set a password — you can use the Password tab from then on
          instead of waiting for email.
        </p>
      </section>
    );
  }

  return (
    <>
      <div style={tabsStyle} role="tablist" aria-label="Sign-in method">
        <button
          type="button"
          role="tab"
          aria-selected={method === "magic"}
          onClick={() => {
            setMethod("magic");
            setError(null);
          }}
          style={method === "magic" ? activeTabStyle : tabStyle}
        >
          Magic link
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={method === "password"}
          onClick={() => {
            setMethod("password");
            setError(null);
            setMagicMode("email");
          }}
          style={method === "password" ? activeTabStyle : tabStyle}
        >
          Password
        </button>
      </div>

      {method === "password" ? (
        <form onSubmit={submitPassword} style={formStyle}>
          <Field label="Email">
            <input
              type="email"
              required
              autoFocus
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
              disabled={submitting}
              placeholder="you@example.com"
            />
          </Field>
          <Field label="Password">
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
              disabled={submitting}
            />
          </Field>
          {error && <ErrorBox text={error} />}
          <button type="submit" disabled={submitting} style={primaryButtonStyle}>
            {submitting ? "Signing in…" : "Sign in"}
          </button>
          <p style={hintStyle}>
            First time? Use the <strong>Magic link</strong> tab, then set
            a password from{" "}
            <a href="/auth/set-password" style={inlineLinkStyle}>
              your account
            </a>
            .
          </p>
        </form>
      ) : magicMode === "invite" ? (
        <form onSubmit={submitMagicInvite} style={formStyle}>
          <p style={modeNoteStyle}>
            We don&rsquo;t recognise <strong>{email}</strong> yet. Add an
            invite code to continue.
          </p>
          <Field label="Email">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
              disabled={submitting}
            />
          </Field>
          <Field
            label="Invite code"
            hint="A short string a Situate editor sent you. Case-insensitive."
          >
            <input
              type="text"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              style={{
                ...inputStyle,
                fontFamily: "ui-monospace, SFMono-Regular, monospace",
                letterSpacing: 1.5,
                textTransform: "uppercase",
              }}
              disabled={submitting}
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={32}
            />
          </Field>
          {error && <ErrorBox text={error} />}
          <button type="submit" disabled={submitting} style={primaryButtonStyle}>
            {submitting ? "Sending…" : "Redeem code & sign in"}
          </button>
          <button
            type="button"
            onClick={() => {
              setMagicMode("email");
              setError(null);
            }}
            style={textButtonStyle}
          >
            Use a different email
          </button>
        </form>
      ) : (
        <form onSubmit={submitMagicEmail} style={formStyle}>
          <Field label="Email">
            <input
              type="email"
              required
              autoFocus
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
              disabled={submitting}
              placeholder="you@example.com"
            />
          </Field>
          {error && <ErrorBox text={error} />}
          <button type="submit" disabled={submitting} style={primaryButtonStyle}>
            {submitting ? "Sending…" : "Email me a sign-in link"}
          </button>
        </form>
      )}
    </>
  );
}

function humanError(data: { error: string; reason?: string }): string {
  switch (data.reason) {
    case "code_unknown":
      return "That invite code isn’t valid. Double-check the spelling.";
    case "code_expired":
      return "That invite code has expired. Ask whoever sent it for a new one.";
    case "code_used_up":
      return "That invite code has already been used up.";
    case "rate_limit":
      return "Too many sign-in attempts. Wait a minute and try again.";
    default:
      return data.error ?? "Something went wrong. Please try again.";
  }
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {hint && <div style={hintStyle}>{hint}</div>}
      {children}
    </div>
  );
}

function ErrorBox({ text }: { text: string }) {
  return (
    <div role="alert" style={errorBoxStyle}>
      {text}
    </div>
  );
}

const tabsStyle: React.CSSProperties = {
  display: "flex",
  gap: 4,
  borderBottom: "1px solid #e8e3d8",
  marginBottom: 22,
};
const tabStyle: React.CSSProperties = {
  padding: "10px 14px",
  background: "transparent",
  border: "none",
  borderBottom: "2px solid transparent",
  marginBottom: -1,
  fontSize: 13,
  letterSpacing: 0.4,
  color: "#888",
  cursor: "pointer",
};
const activeTabStyle: React.CSSProperties = {
  ...tabStyle,
  color: "#1a1a1a",
  borderBottomColor: "#1a1a1a",
};
const formStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 16,
};
const modeNoteStyle: React.CSSProperties = {
  fontSize: 14,
  background: "#fbfaf6",
  border: "1px solid #e8e3d8",
  borderRadius: 3,
  padding: 12,
  color: "#444",
  lineHeight: 1.5,
};
const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  textTransform: "uppercase",
  letterSpacing: 1.5,
  color: "#666",
  marginBottom: 6,
};
const hintStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#888",
  marginBottom: 6,
  lineHeight: 1.55,
};
const inputStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: "10px 12px",
  fontSize: 14,
  fontFamily: "inherit",
  border: "1px solid #c8c2b3",
  borderRadius: 3,
  background: "white",
  color: "#1a1a1a",
};
const primaryButtonStyle: React.CSSProperties = {
  padding: "12px 18px",
  background: "#1a1a1a",
  color: "white",
  border: "none",
  borderRadius: 3,
  fontFamily: "system-ui",
  fontSize: 14,
  letterSpacing: 0.4,
  cursor: "pointer",
};
const textButtonStyle: React.CSSProperties = {
  alignSelf: "flex-start",
  padding: "6px 0",
  background: "transparent",
  border: "none",
  color: "#666",
  fontSize: 12,
  letterSpacing: 0.4,
  textDecoration: "underline",
  cursor: "pointer",
};
const panelStyle: React.CSSProperties = {
  padding: 20,
  border: "1px solid #e8e3d8",
  borderRadius: 4,
  background: "#fbfaf6",
};
const panelTitleStyle: React.CSSProperties = {
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize: 22,
  fontWeight: 400,
  margin: "0 0 10px",
};
const panelBodyStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 14,
  color: "#555",
  lineHeight: 1.6,
};
const panelHintStyle: React.CSSProperties = {
  marginTop: 14,
  fontSize: 12,
  color: "#888",
  lineHeight: 1.55,
};
const inlineLinkStyle: React.CSSProperties = {
  color: "#1a1a1a",
  textDecoration: "underline",
};
const errorBoxStyle: React.CSSProperties = {
  padding: 12,
  background: "#fce9e9",
  border: "1px solid #dc2626",
  borderRadius: 3,
  color: "#7f1d1d",
  fontSize: 13,
};
