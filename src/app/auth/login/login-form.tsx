"use client";

import { useState } from "react";

/**
 * Two-mode login form:
 *
 *   1. Default: email only. Hits `/api/auth/request-login` which calls
 *      `signInWithOtp({shouldCreateUser: false})`. If the email is already
 *      a Supabase user → magic link sent. If not → server returns
 *      `needs_invite` and we flip to mode 2.
 *
 *   2. Invite mode: email + invite code. Hits `/api/auth/invite` which
 *      validates the code against `invite_codes`, then calls the admin
 *      API to create the user + send the invite email. Server-side only
 *      (service-role key).
 *
 * On either path the user receives an email; this form's "submitted" state
 * is a stable thank-you screen that survives a refresh (no token to lose).
 */

type Mode = "email" | "invite";

export function LoginForm({ next }: { next: string }) {
  const [mode, setMode] = useState<Mode>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submitEmail(e: React.FormEvent) {
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
        setMode("invite");
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitInvite(e: React.FormEvent) {
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

  if (sent) {
    return (
      <section style={panelStyle}>
        <h2 style={panelTitleStyle}>Check your inbox.</h2>
        <p style={panelBodyStyle}>
          We sent a one-time sign-in link to <strong>{email}</strong>. It
          works for an hour, then expires. If it doesn&rsquo;t arrive in a
          minute or two, check your spam folder.
        </p>
      </section>
    );
  }

  if (mode === "invite") {
    return (
      <form onSubmit={submitInvite} style={formStyle}>
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
            setMode("email");
            setError(null);
          }}
          style={textButtonStyle}
        >
          Use a different email
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={submitEmail} style={formStyle}>
      <Field label="Email">
        <input
          type="email"
          required
          autoFocus
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
const errorBoxStyle: React.CSSProperties = {
  padding: 12,
  background: "#fce9e9",
  border: "1px solid #dc2626",
  borderRadius: 3,
  color: "#7f1d1d",
  fontSize: 13,
};
