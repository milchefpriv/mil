import type { Session } from "@supabase/supabase-js";
import { ArrowRight, FileText, LoaderCircle, Mail } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

import InvoiceApp from "./InvoiceApp";
import { supabase } from "./supabase";

export default function AuthGate() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("mil.chef.priv@gmail.com");
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
    setSent(false);
    setError("");

    const emailRedirectTo = new URL("./", window.location.href).href;
    const { error: signInError } = await supabase.auth.signInWithOtp({
      email: cleanEmail,
      options: { emailRedirectTo, shouldCreateUser: true },
    });

    if (signInError) setError("Connexion impossible. Réessaie dans un instant.");
    else setSent(true);
    setSending(false);
  }

  if (loading) {
    return (
      <main className="loading-screen">
        <span className="brand-seal"><FileText size={22} /></span>
        <LoaderCircle className="spin" size={22} />
      </main>
    );
  }

  if (!session) {
    return (
      <main className="auth-screen">
        <section className="auth-panel">
          <div className="auth-brand">
            <span className="brand-seal"><FileText size={23} /></span>
            <strong>FACTURES</strong>
          </div>

          <div className="auth-copy">
            <span className="eyebrow">ESPACE PERSONNEL</span>
            <h1>Facturer.<br />Simplement.</h1>
            <p>Clients, factures et PDF réunis au même endroit.</p>
          </div>

          <form className="auth-form" onSubmit={requestLink}>
            <label htmlFor="login-email">Adresse e-mail</label>
            <div className="auth-field">
              <Mail size={18} />
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
            <button type="submit" className="primary-button auth-button" disabled={sending}>
              {sending ? <LoaderCircle className="spin" size={18} /> : <ArrowRight size={18} />}
              {sending ? "Envoi…" : "Recevoir le lien"}
            </button>
            {sent && <p className="form-message success">Lien envoyé. Ouvre ta messagerie.</p>}
            {error && <p className="form-message error">{error}</p>}
          </form>
        </section>

        <aside className="auth-art" aria-hidden="true">
          <div className="invoice-paper-demo">
            <span className="demo-kicker">FACTURE</span>
            <strong>N° 2701</strong>
            <div className="demo-rule" />
            <div className="demo-grid">
              <i /><i /><i /><i /><i /><i />
            </div>
            <div className="demo-total">1 250,00 €</div>
          </div>
          <span className="art-caption">NET · PRÉCIS · PROFESSIONNEL</span>
        </aside>
      </main>
    );
  }

  return (
    <InvoiceApp
      user={{ id: session.user.id, email: session.user.email || "Compte connecté" }}
      onSignOut={() => void supabase.auth.signOut()}
    />
  );
}
