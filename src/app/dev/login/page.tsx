import Link from "next/link";

import { getServerSupabase } from "@/lib/supabase/server";

export const metadata = {
  title: "Dev login · Situate Editions",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * /dev/login — UI for the dev-only backdoor login.
 *
 * Only useful on preview deployments where magic-link cookies don't
 * survive a re-deploy. The form posts to /api/dev/login which mints a
 * real Supabase session via the admin SDK + verifyOtp.
 *
 * The page itself is always rendered, but the form is disabled and
 * replaced by an explanatory message when DEV_LOGIN_SECRET isn't set
 * in the environment — so a curious visitor on production gets the
 * "feature off" message instead of a confusing form.
 */

type SearchParams = Promise<{ error?: string; next?: string }>;

export default async function DevLoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { error, next } = await searchParams;
  const enabled = Boolean(process.env.DEV_LOGIN_SECRET);

  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main style={mainStyle}>
      <p style={kickerStyle}>Preview · Dev only</p>
      <h1 style={h1Style}>Backdoor login</h1>

      <div style={warningStyle}>
        <strong>Never set DEV_LOGIN_SECRET in production.</strong> Anyone
        who knows the secret can log in as any registered user. This
        page exists because magic-link auth cookies don&rsquo;t survive
        a Vercel preview redeploy.
      </div>

      {user ? (
        <div style={infoStyle}>
          Already signed in as <code>{user.email}</code>.{" "}
          <Link href="/auth/logout" style={inlineLinkStyle}>
            Log out
          </Link>{" "}
          if you want to switch accounts.
        </div>
      ) : null}

      {!enabled ? (
        <div style={disabledStyle}>
          <p style={{ margin: 0 }}>
            <strong>Feature off.</strong> Set <code>DEV_LOGIN_SECRET</code>{" "}
            in this environment&rsquo;s settings to enable. The route at{" "}
            <code>POST /api/dev/login</code> will return <code>503</code>{" "}
            until you do.
          </p>
        </div>
      ) : (
        <>
          {error ? (
            <div style={errorStyle}>{renderError(error)}</div>
          ) : null}
          <form action="/api/dev/login" method="post" style={formStyle}>
            <label style={labelStyle}>
              Email
              <input
                type="email"
                name="email"
                required
                autoComplete="off"
                spellCheck={false}
                style={inputStyle}
                placeholder="you@example.com"
              />
            </label>
            <label style={labelStyle}>
              Dev secret
              <input
                type="password"
                name="secret"
                required
                autoComplete="off"
                style={inputStyle}
                placeholder="value of DEV_LOGIN_SECRET"
              />
            </label>
            <label style={labelStyle}>
              Redirect to after login (optional)
              <input
                type="text"
                name="next"
                defaultValue={next ?? "/write"}
                style={inputStyle}
                placeholder="/write"
              />
            </label>
            <button type="submit" style={buttonStyle}>
              Log in →
            </button>
          </form>
          <p style={hintStyle}>
            The email must already exist in <code>auth.users</code>. To
            seed a fresh account, use{" "}
            <Link href="/auth/login" style={inlineLinkStyle}>
              the regular invite flow
            </Link>{" "}
            once, then come back here on subsequent redeploys.
          </p>
        </>
      )}
    </main>
  );
}

function renderError(code: string): string {
  switch (code) {
    case "invalid_credentials":
      return "Invalid email or secret.";
    case "missing_fields":
      return "Email and secret are both required.";
    case "missing_form":
      return "Malformed form submission.";
    case "verify_failed":
      return "Generated link couldn't be verified. Check that DEV_LOGIN_SECRET matches.";
    default:
      return `Login failed (${code}).`;
  }
}

const mainStyle: React.CSSProperties = {
  maxWidth: 540,
  margin: "0 auto",
  padding: "70px 28px 120px",
  fontFamily: "system-ui, sans-serif",
  color: "#1a1a1a",
};
const kickerStyle: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: 2,
  textTransform: "uppercase",
  color: "#9b8a6b",
  margin: 0,
};
const h1Style: React.CSSProperties = {
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize: 38,
  fontWeight: 400,
  letterSpacing: -0.6,
  margin: "8px 0 24px",
};
const warningStyle: React.CSSProperties = {
  padding: 14,
  background: "#fef3c7",
  border: "1px solid #d97706",
  borderRadius: 3,
  fontSize: 13,
  lineHeight: 1.55,
  color: "#7c2d12",
  marginBottom: 18,
};
const infoStyle: React.CSSProperties = {
  padding: 12,
  background: "#f0f9ff",
  border: "1px solid #bae6fd",
  borderRadius: 3,
  fontSize: 13,
  color: "#0c4a6e",
  marginBottom: 18,
};
const disabledStyle: React.CSSProperties = {
  padding: 18,
  background: "#fbfaf6",
  border: "1px solid #e8e3d8",
  borderRadius: 3,
  fontSize: 13,
  color: "#555",
  lineHeight: 1.6,
};
const errorStyle: React.CSSProperties = {
  padding: 12,
  background: "#fee2e2",
  border: "1px solid #fca5a5",
  borderRadius: 3,
  fontSize: 13,
  color: "#7f1d1d",
  marginBottom: 14,
};
const formStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 14,
};
const labelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  fontSize: 12,
  letterSpacing: 0.4,
  textTransform: "uppercase",
  color: "#666",
};
const inputStyle: React.CSSProperties = {
  padding: "10px 12px",
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize: 16,
  border: "1px solid #d4cfc2",
  borderRadius: 3,
  background: "white",
  color: "#1a1a1a",
  outline: "none",
};
const buttonStyle: React.CSSProperties = {
  alignSelf: "flex-start",
  marginTop: 6,
  padding: "12px 20px",
  background: "#1a1a1a",
  color: "white",
  border: "none",
  borderRadius: 3,
  fontSize: 14,
  letterSpacing: 0.4,
  cursor: "pointer",
};
const hintStyle: React.CSSProperties = {
  marginTop: 18,
  fontSize: 12,
  color: "#888",
  lineHeight: 1.6,
};
const inlineLinkStyle: React.CSSProperties = {
  color: "#1a1a1a",
  textDecoration: "underline",
};
