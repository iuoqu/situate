"use client";

import { useState } from "react";

/**
 * Newsletter signup — single email field, lower-commitment than the
 * waitlist. Posts to /api/waitlist with `kind: "newsletter"`. Reuses
 * the same backend table; the API handles the per-kind unique index.
 *
 * No "tell us about a place" textarea — that's what distinguishes the
 * write-invite path. Newsletter is meant to be a one-click commitment
 * for readers who aren't ready to ask for an invite.
 */
export function NewsletterForm() {
  const [email, setEmail] = useState("");
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
          kind: "newsletter",
          source: "landing-newsletter",
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setErrorText(data.error ?? "Couldn’t subscribe right now. Try again?");
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
      <p style={confirmStyle}>
        Thanks — we&rsquo;ll send you a story when the next issue is ready.
      </p>
    );
  }

  return (
    <form onSubmit={submit} style={formStyle}>
      <input
        required
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={inputStyle}
        disabled={status === "submitting"}
        placeholder="you@example.com"
        aria-label="Email address"
      />
      <button
        type="submit"
        disabled={status === "submitting"}
        style={buttonStyle}
      >
        {status === "submitting" ? "…" : "Subscribe"}
      </button>
      {errorText && (
        <p role="alert" style={errorStyle}>
          {errorText}
        </p>
      )}
    </form>
  );
}

const formStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  alignItems: "stretch",
  maxWidth: 420,
};

const inputStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 180,
  padding: "10px 12px",
  fontSize: 14,
  fontFamily: "system-ui, sans-serif",
  border: "1px solid #c8c2b3",
  borderRadius: 3,
  background: "white",
  color: "#1a1a1a",
};

const buttonStyle: React.CSSProperties = {
  padding: "10px 18px",
  background: "white",
  color: "#1a1a1a",
  border: "1px solid #1a1a1a",
  borderRadius: 3,
  fontFamily: "system-ui, sans-serif",
  fontSize: 14,
  letterSpacing: 0.4,
  cursor: "pointer",
};

const confirmStyle: React.CSSProperties = {
  margin: 0,
  padding: 14,
  background: "#fbfaf6",
  border: "1px solid #e8e3d8",
  borderRadius: 3,
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize: 15,
  color: "#444",
  lineHeight: 1.5,
  maxWidth: 420,
};

const errorStyle: React.CSSProperties = {
  width: "100%",
  margin: "4px 0 0",
  fontFamily: "system-ui, sans-serif",
  fontSize: 12,
  color: "#7f1d1d",
};
