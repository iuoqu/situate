import { redirect } from "next/navigation";

import { getServerSupabase } from "@/lib/supabase/server";

import { LoginForm } from "./login-form";

export const metadata = {
  title: "Sign in · Situate Editions",
  description: "Sign in to Situate Editions with a magic link or password.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reason?: string }>;
}) {
  const { next, reason } = await searchParams;
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    // Already signed in — go where they were headed (default: home).
    redirect(next && next.startsWith("/") ? next : "/");
  }

  return (
    <main style={mainStyle}>
      <header style={{ marginBottom: 28 }}>
        <p style={kickerStyle}>Situate Editions</p>
        <h1 style={h1Style}>Sign in</h1>
        <p style={leadStyle}>
          Use a one-time email link, or sign in with a password if
          you&rsquo;ve set one.
        </p>
        {reason === "auth_required" && (
          <p style={noteStyle}>You need to be signed in to use that page.</p>
        )}
      </header>
      <LoginForm next={next ?? "/"} />
      <footer style={footerStyle}>
        <p style={mutedStyle}>
          Situate is currently in an invite-only beta. If you haven&rsquo;t
          been invited, this page won&rsquo;t let you in.
        </p>
      </footer>
    </main>
  );
}

const mainStyle: React.CSSProperties = {
  maxWidth: 480,
  margin: "0 auto",
  padding: "80px 28px 120px",
  fontFamily: "system-ui, sans-serif",
  color: "#1a1a1a",
};
const kickerStyle: React.CSSProperties = {
  fontFamily: "system-ui",
  fontSize: 11,
  letterSpacing: 2,
  textTransform: "uppercase",
  color: "#9b8a6b",
  margin: 0,
};
const h1Style: React.CSSProperties = {
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize: 40,
  fontWeight: 400,
  letterSpacing: -0.8,
  margin: "10px 0 0",
};
const leadStyle: React.CSSProperties = {
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize: 17,
  color: "#555",
  lineHeight: 1.6,
  marginTop: 12,
};
const noteStyle: React.CSSProperties = {
  marginTop: 18,
  padding: 12,
  fontSize: 13,
  background: "#fbfaf6",
  border: "1px solid #e8e3d8",
  borderRadius: 3,
  color: "#666",
};
const footerStyle: React.CSSProperties = {
  marginTop: 40,
  borderTop: "1px solid #e8e3d8",
  paddingTop: 18,
};
const mutedStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#888",
  lineHeight: 1.5,
};
