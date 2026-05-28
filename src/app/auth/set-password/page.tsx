import { redirect } from "next/navigation";

import { getServerSupabase } from "@/lib/supabase/server";

import { SetPasswordForm } from "./set-password-form";

export const metadata = {
  title: "Set password · Situate Editions",
  description: "Set a password so you don't need an email link each time.",
};

export const dynamic = "force-dynamic";

export default async function SetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(
      `/auth/login?reason=auth_required&next=${encodeURIComponent(
        `/auth/set-password${next ? `?next=${encodeURIComponent(next)}` : ""}`,
      )}`,
    );
  }

  const safeNext = next && next.startsWith("/") ? next : "/";

  return (
    <main style={mainStyle}>
      <header style={{ marginBottom: 28 }}>
        <p style={kickerStyle}>Account</p>
        <h1 style={h1Style}>Set a password</h1>
        <p style={leadStyle}>
          You&rsquo;re signed in as <strong>{user.email}</strong>. Set a
          password so you can skip the email link next time — handy on
          preview deploys where session cookies don&rsquo;t survive.
        </p>
      </header>
      <SetPasswordForm next={safeNext} />
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
  margin: "10px 0 0",
};
const leadStyle: React.CSSProperties = {
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize: 16,
  color: "#555",
  lineHeight: 1.6,
  marginTop: 12,
};
