import { FormEvent, StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type { Session } from "@supabase/supabase-js";
import Home from "./page";
import "./globals.css";
import { loadSharedState, supabase } from "./shared-state";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Le point de montage de l’application est introuvable.");
}

function AuthGate() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessStatus, setAccessStatus] = useState<"idle" | "checking" | "allowed">("idle");
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

    setAccessStatus("checking");
    void loadSharedState("cuisine")
      .then((row) => {
        if (!active) return;
        if (!row) throw new Error("Accès refusé");
        setAccessStatus("allowed");
      })
      .catch(() => {
        if (!active) return;
        setError("Cette adresse n’est pas autorisée pour Chez Auguste.");
        setAccessStatus("idle");
        void supabase.auth.signOut();
      });

    return () => { active = false; };
  }, [session]);

  async function requestLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = email.trim().toLocaleLowerCase("fr-FR");
    setError("");
    setSent(false);
    setSending(true);
    const emailRedirectTo = new URL("./", window.location.href).href;
    const { error: signInError } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: { emailRedirectTo, shouldCreateUser: true },
    });
    setSending(false);
    if (signInError) {
      setError("Le lien n’a pas pu être envoyé. Réessayez dans un instant.");
      return;
    }
    setSent(true);
  }

  if (loading || (session && accessStatus === "checking")) {
    return <main className="auguste-auth-screen"><section className="auguste-auth-card loading"><div className="auguste-auth-mark">A</div><p>Ouverture de Chez Auguste…</p></section></main>;
  }

  const sessionEmail = session?.user.email?.toLocaleLowerCase("fr-FR") || "";
  if (session && accessStatus === "allowed") {
    return <Home userId={session.user.id} userEmail={sessionEmail} onSignOut={() => void supabase.auth.signOut()} />;
  }

  return (
    <main className="auguste-auth-screen">
      <section className="auguste-auth-card">
        <div className="auguste-auth-mark">A</div>
        <p className="eyebrow">Espace privé synchronisé</p>
        <h1>Chez Auguste,<br />partagé en direct.</h1>
        <p>Connectez-vous avec votre adresse autorisée. Les menus, fiches techniques et données du bar seront identiques sur tous vos appareils.</p>
        <form onSubmit={requestLink}>
          <label htmlFor="auguste-auth-email">Adresse e-mail</label>
          <input
            id="auguste-auth-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="vous@exemple.fr"
            required
          />
          <button type="submit" disabled={sending}>{sending ? "Envoi…" : "Recevoir mon lien de connexion"}</button>
        </form>
        {sent && <p className="auguste-auth-feedback success">Le lien vient d’être envoyé. Ouvrez-le depuis votre messagerie.</p>}
        {error && <p className="auguste-auth-feedback error">{error}</p>}
        <small>Accès réservé à Emile et Auguste</small>
      </section>
    </main>
  );
}

createRoot(root).render(<StrictMode><AuthGate /></StrictMode>);
