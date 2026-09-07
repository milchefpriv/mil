import { FormEvent, StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type { Session } from "@supabase/supabase-js";
import Home from "./page";
import "./globals.css";
import { loadSharedState, supabase } from "./shared-state";

type PasswordLoginResponse = {
  access_token?: string;
  refresh_token?: string;
};

const AUGUSTE_AUTH_EMAIL = "chez-auguste@access.invalid";

function signOutLocally() {
  return supabase.auth.signOut({ scope: "local" });
}

const root = document.getElementById("root");

if (!root) {
  throw new Error("Le point de montage de l’application est introuvable.");
}

function AuthGate() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessStatus, setAccessStatus] = useState<"idle" | "checking" | "allowed">("idle");
  const [password, setPassword] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setLoading(false);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let active = true;
    if (!session) {
      setAccessStatus("idle");
      return () => { active = false; };
    }

    if (session.user.email?.toLocaleLowerCase("fr-FR") !== AUGUSTE_AUTH_EMAIL) {
      setError("Entrez le mot de passe Chez Auguste.");
      setAccessStatus("idle");
      void signOutLocally();
      return () => { active = false; };
    }

    setAccessStatus("checking");
    void loadSharedState("cuisine")
      .then((row) => {
        if (!active) return;
        if (!row) throw new Error("Accès refusé");
        setAccessStatus("allowed");
      })
      .catch(() => {
        if (!active) return;
        setError("Impossible d’ouvrir Chez Auguste.");
        setAccessStatus("idle");
        void signOutLocally();
      });

    return () => { active = false; };
  }, [session]);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!password) return;

    setError("");
    setSigningIn(true);

    const { data, error: loginError } =
      await supabase.functions.invoke<PasswordLoginResponse>(
        "auguste-password-login",
        { body: { password } },
      );

    if (loginError || !data?.access_token || !data.refresh_token) {
      setError("Mot de passe incorrect.");
      setSigningIn(false);
      return;
    }

    const { error: sessionError } = await supabase.auth.setSession({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
    });

    if (sessionError) {
      setError("Mot de passe incorrect.");
    } else {
      setPassword("");
    }
    setSigningIn(false);
  }

  if (loading || (session && accessStatus === "checking")) {
    return <main className="auguste-auth-screen"><section className="auguste-auth-card loading"><div className="auguste-auth-mark">A</div><p>Ouverture de Chez Auguste…</p></section></main>;
  }

  if (session && accessStatus === "allowed") {
    return <Home userId={session.user.id} onSignOut={() => void signOutLocally()} />;
  }

  return (
    <main className="auguste-auth-screen">
      <section className="auguste-auth-card">
        <div className="auguste-auth-mark">A</div>
        <p className="eyebrow">Espace privé</p>
        <h1>Chez Auguste</h1>
        <p>Entrez simplement le mot de passe pour continuer.</p>
        <form onSubmit={signIn}>
          <label htmlFor="auguste-auth-password">Mot de passe</label>
          <input
            id="auguste-auth-password"
            type="password"
            autoComplete="current-password"
            enterKeyHint="go"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Votre mot de passe"
            required
            autoFocus
          />
          <button type="submit" disabled={signingIn}>{signingIn ? "Ouverture…" : "Ouvrir Chez Auguste"}</button>
        </form>
        {error && <p className="auguste-auth-feedback error">{error}</p>}
        <small>Accès équipe Chez Auguste</small>
      </section>
    </main>
  );
}

createRoot(root).render(<StrictMode><AuthGate /></StrictMode>);
