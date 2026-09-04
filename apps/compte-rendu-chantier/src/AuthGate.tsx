import type { Session } from "@supabase/supabase-js";
import { KeyRound, LoaderCircle, LockKeyhole } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

import ChantierApp from "./ChantierApp";
import { supabase } from "./supabase";

type PasswordSessionResponse = {
  access_token?: string;
  refresh_token?: string;
};

export default function AuthGate() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
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

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!password) return;

    setSigningIn(true);
    setError("");

    const { data, error: loginError } =
      await supabase.functions.invoke<PasswordSessionResponse>(
        "chantier-password-login",
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

  if (loading) {
    return (
      <main className="loading-screen">
        <div className="loading-mark">CR</div>
        <LoaderCircle className="sync-spinner" size={22} />
        <p>Ouverture de votre espace chantier…</p>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="auth-screen">
        <section className="auth-card">
          <div className="auth-mark">CR</div>
          <div className="auth-heading">
            <span><LockKeyhole size={14} /> Espace privé synchronisé</span>
            <h1>Vos comptes rendus,<br />sur tous vos appareils.</h1>
            <p>Entrez simplement votre mot de passe pour ouvrir vos chantiers.</p>
          </div>

          <form className="auth-form" onSubmit={signIn}>
            <label htmlFor="auth-password">Mot de passe</label>
            <div className="auth-input-wrap">
              <KeyRound size={18} />
              <input
                id="auth-password"
                type="password"
                autoComplete="current-password"
                enterKeyHint="go"
                placeholder="Votre mot de passe"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                autoFocus
              />
            </div>
            <button type="submit" disabled={signingIn}>
              {signingIn ? <LoaderCircle className="sync-spinner" size={18} /> : <KeyRound size={18} />}
              {signingIn ? "Ouverture…" : "Ouvrir mes comptes rendus"}
            </button>
          </form>

          {error && <p className="auth-feedback error">{error}</p>}

          <small>Compte Rendu Chantier · Espace privé</small>
        </section>
      </main>
    );
  }

  const userEmail = session.user.email ?? "Compte connecté";
  const displayName =
    typeof session.user.user_metadata.full_name === "string"
      ? session.user.user_metadata.full_name
      : userEmail;

  return (
    <ChantierApp
      user={{ id: session.user.id, displayName, email: userEmail }}
      onSignOut={() => void supabase.auth.signOut()}
    />
  );
}
