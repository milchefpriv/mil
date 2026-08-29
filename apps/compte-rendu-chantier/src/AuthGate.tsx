import type { Session } from "@supabase/supabase-js";
import { LoaderCircle, LockKeyhole, Mail } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

import ChantierApp from "./ChantierApp";
import { supabase } from "./supabase";

export default function AuthGate() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
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

  async function requestLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanEmail = email.trim().toLocaleLowerCase();
    if (!cleanEmail) return;

    setSending(true);
    setError("");
    setSent(false);

    const emailRedirectTo = new URL("./", window.location.href).href;
    const { error: signInError } = await supabase.auth.signInWithOtp({
      email: cleanEmail,
      options: {
        emailRedirectTo,
        shouldCreateUser: true,
      },
    });

    if (signInError) {
      setError("Le lien de connexion n’a pas pu être envoyé. Réessayez.");
    } else {
      setSent(true);
    }
    setSending(false);
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
            <p>
              Entrez votre adresse e-mail. Vous recevrez un lien sécurisé pour
              ouvrir vos chantiers, sans mot de passe.
            </p>
          </div>

          <form className="auth-form" onSubmit={requestLink}>
            <label htmlFor="auth-email">Adresse e-mail</label>
            <div className="auth-input-wrap">
              <Mail size={18} />
              <input
                id="auth-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="vous@exemple.fr"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
            <button type="submit" disabled={sending}>
              {sending ? <LoaderCircle className="sync-spinner" size={18} /> : <Mail size={18} />}
              {sending ? "Envoi…" : "Recevoir mon lien de connexion"}
            </button>
          </form>

          {sent && (
            <p className="auth-feedback success">
              Le lien vient d’être envoyé. Ouvrez-le depuis votre messagerie.
            </p>
          )}
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
