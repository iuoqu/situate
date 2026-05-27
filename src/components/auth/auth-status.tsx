import Link from "next/link";

import { getServerSupabase } from "@/lib/supabase/server";

/**
 * Tiny "signed in as / sign in" indicator. Server component, renders inside
 * the root layout. Stays out of the way visually — top-right corner.
 */
export async function AuthStatus() {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div style={shellStyle}>
        <Link href="/auth/login" style={linkStyle}>
          Sign in
        </Link>
      </div>
    );
  }

  // Truncate long emails so they don't blow out the layout. Real names
  // come later if/when we add profile UI.
  const label =
    user.email && user.email.length > 28
      ? user.email.slice(0, 25) + "…"
      : user.email ?? "Signed in";

  return (
    <div style={shellStyle}>
      <span style={emailStyle} title={user.email ?? undefined}>
        {label}
      </span>
      <form action="/auth/logout" method="post" style={{ margin: 0 }}>
        <button type="submit" style={signOutStyle}>
          Sign out
        </button>
      </form>
    </div>
  );
}

const shellStyle: React.CSSProperties = {
  position: "fixed",
  top: 14,
  right: 18,
  display: "flex",
  gap: 10,
  alignItems: "center",
  fontFamily: "system-ui, sans-serif",
  fontSize: 12,
  color: "#666",
  zIndex: 50,
  // The component lives behind any modal / drawer; we keep z-index modest.
};

const linkStyle: React.CSSProperties = {
  padding: "5px 10px",
  background: "white",
  border: "1px solid #c8c2b3",
  borderRadius: 3,
  color: "#1a1a1a",
  textDecoration: "none",
  letterSpacing: 0.4,
};

const emailStyle: React.CSSProperties = {
  padding: "4px 8px",
  background: "rgba(255,255,255,.88)",
  border: "1px solid #e8e3d8",
  borderRadius: 3,
  color: "#666",
  fontVariantNumeric: "tabular-nums",
};

const signOutStyle: React.CSSProperties = {
  padding: "4px 8px",
  background: "transparent",
  border: "1px solid #c8c2b3",
  borderRadius: 3,
  color: "#666",
  fontSize: 11,
  letterSpacing: 0.4,
  cursor: "pointer",
};
