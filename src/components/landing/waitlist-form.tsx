"use client";

import { useState } from "react";

/**
 * Inline waitlist form for the landing page. Drops the email + optional
 * note into `waitlist_requests` via POST /api/waitlist. Stateful, but
 * deliberately stateless across page loads — no localStorage. The user
 * either gets a code by email (admin issues one + sends it) or they don't,
 * and they can re-submit harmlessly (the endpoint is idempotent per email).
 */
export function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">(
    "idle",
  );
  const [errorText, setErrorText] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "submitting") return;
    setStatus("submitting");
    setErrorText(null);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          note: note.trim() || undefined,
          source: "landing",
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setErrorText(data.error ?? "Couldn’t send your request. Try again?");
        setStatus("error");
        return;
      }
      setStatus("done");
    } catch {
      setErrorText("Network error. Try again?");
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <div style={panelStyle}>
        <h3 style={panelTitleStyle}>You&rsquo;re on the list.</h3>
        <p style={panelBodyStyle}>
          We read every request. If you fit, you&rsquo;ll get a code by
          email. We don&rsquo;t spam.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} style={formStyle}>
      <div style={fieldRowStyle}>
        <Field label="Email">
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
            disabled={status === "submitting"}
            placeholder="you@example.com"
          />
        </Field>
      </div>
      <Field
        label="Tell us about a place (optional)"
        hint="One or two sentences. Helps us prioritise."
      >
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          style={{ ...inputStyle, minHeight: 84, fontFamily: 'Georgia, "Times New Roman", serif', lineHeight: 1.55 }}
          maxLength={600}
          disabled={status === "submitting"}
          placeholder="The corner of Cassia and 5th, the laundromat at 3am, the bend in the river where…"
        />
      </Field>
      {errorText && (
        <div role="alert" style={errorBoxStyle}>
          {errorText}
        </div>
      )}
      <button
        type="submit"
        disabled={status === "submitting"}
        style={primaryButtonStyle}
      >
        {status === "submitting" ? "Sending…" : "Request an invite"}
      </button>
    </form>
  );
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

const formStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 14,
};
const fieldRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr",
  gap: 14,
};
const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
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
  alignSelf: "flex-start",
  padding: "12px 20px",
  background: "#1a1a1a",
  color: "white",
  border: "none",
  borderRadius: 3,
  fontFamily: "system-ui",
  fontSize: 14,
  letterSpacing: 0.4,
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
  margin: "0 0 8px",
  letterSpacing: -0.2,
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
