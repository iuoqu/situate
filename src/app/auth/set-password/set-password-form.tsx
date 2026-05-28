"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const MIN_LEN = 8;

export function SetPasswordForm({ next }: { next: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < MIN_LEN) {
      setError(`Password must be at least ${MIN_LEN} characters.`);
      return;
    }
    if (password !== confirm) {
      setError("The two passwords don't match.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await res.json()) as { status?: string; error?: string };
      if (data.status === "ok") {
        setDone(true);
      } else {
        setError(data.error ?? "Couldn't update password.");
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <section style={panelStyle}>
        <h2 style={panelTitleStyle}>Password set.</h2>
        <p style={panelBodyStyle}>
          Next time you sign in, pick the <strong>Password</strong> tab
          on the login page.
        </p>
        <button
          type="button"
          onClick={() => router.push(next)}
          style={primaryButtonStyle}
        >
          Continue →
        </button>
      </section>
    );
  }

  return (
    <form onSubmit={submit} style={formStyle}>
      <Field label="New password" hint={`At least ${MIN_LEN} characters.`}>
        <input
          type="password"
          required
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={inputStyle}
          disabled={submitting}
          minLength={MIN_LEN}
        />
      </Field>
      <Field label="Confirm password">
        <input
          type="password"
          required
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          style={inputStyle}
          disabled={submitting}
        />
      </Field>
      {error && (
        <div role="alert" style={errorBoxStyle}>
          {error}
        </div>
      )}
      <button type="submit" disabled={submitting} style={primaryButtonStyle}>
        {submitting ? "Saving…" : "Set password"}
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
  gap: 16,
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
const panelStyle: React.CSSProperties = {
  padding: 20,
  border: "1px solid #e8e3d8",
  borderRadius: 4,
  background: "#fbfaf6",
  display: "flex",
  flexDirection: "column",
  gap: 12,
};
const panelTitleStyle: React.CSSProperties = {
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize: 22,
  fontWeight: 400,
  margin: 0,
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
