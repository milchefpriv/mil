import { Check, Save } from "lucide-react";
import { FormEvent, useState } from "react";

import type { IssuerProfile } from "./types";

export default function SettingsView({ profile, onSave }: { profile: IssuerProfile; onSave: (profile: IssuerProfile) => Promise<void> }) {
  const [value, setValue] = useState(profile);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function update<K extends keyof IssuerProfile>(key: K, next: IssuerProfile[K]) {
    setValue((current) => ({ ...current, [key]: next }));
    setSaved(false);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await onSave(value);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="page-view settings-view">
      <header className="page-heading"><div><span className="eyebrow">PROFIL DE FACTURATION</span><h1>Paramètres</h1></div></header>
      <form className="settings-card" onSubmit={submit}>
        <div className="settings-section">
          <h2>Émetteur</h2>
          <div className="form-grid two">
            <label>Nom légal<input value={value.legal_name} onChange={(e) => update("legal_name", e.target.value)} required /></label>
            <label>Nom commercial<input value={value.trade_name} onChange={(e) => update("trade_name", e.target.value)} placeholder="Facultatif" /></label>
            <label>SIREN<input value={value.siren} onChange={(e) => update("siren", e.target.value.replace(/\D/g, "").slice(0, 9))} required /></label>
            <label>SIRET<input value={value.siret} onChange={(e) => update("siret", e.target.value.replace(/\D/g, "").slice(0, 14))} required /></label>
          </div>
          <label>Adresse<input value={value.address} onChange={(e) => update("address", e.target.value)} required /></label>
          <div className="form-grid postcode-grid">
            <label>Code postal<input value={value.postcode} onChange={(e) => update("postcode", e.target.value)} required /></label>
            <label>Ville<input value={value.city} onChange={(e) => update("city", e.target.value)} required /></label>
          </div>
          <label>Téléphone<input value={value.phone} onChange={(e) => update("phone", e.target.value)} /></label>
        </div>

        <div className="settings-section">
          <h2>E-mails disponibles</h2>
          {value.emails.map((email, index) => (
            <div className="email-setting" key={`${email}-${index}`}>
              <input
                type="email"
                value={email}
                onChange={(event) => {
                  const emails = [...value.emails];
                  emails[index] = event.target.value;
                  update("emails", emails);
                }}
              />
              <label className="default-email-choice">
                <input type="radio" name="default-email" checked={value.default_email === email} onChange={() => update("default_email", email)} />
                Par défaut
              </label>
            </div>
          ))}
        </div>

        <div className="settings-section">
          <h2>Paiement</h2>
          <div className="form-grid two">
            <label>IBAN<input value={value.iban} onChange={(e) => update("iban", e.target.value.toUpperCase())} placeholder="Facultatif" /></label>
            <label>BIC<input value={value.bic} onChange={(e) => update("bic", e.target.value.toUpperCase())} placeholder="Facultatif" /></label>
            <label>Délai par défaut <span className="input-suffix"><input type="number" min="0" max="90" value={value.payment_terms_days} onChange={(e) => update("payment_terms_days", Number(e.target.value))} /><b>jours</b></span></label>
            <label>Pénalités de retard <span className="input-suffix"><input type="number" min="0" step="0.01" value={value.penalty_rate} onChange={(e) => update("penalty_rate", Number(e.target.value))} /><b>%</b></span></label>
          </div>
        </div>

        <div className="legal-fixed">
          <Check size={18} />
          <p><strong>Franchise en base de TVA</strong><span>La mention CIBS et les mentions de règlement sont ajoutées automatiquement.</span></p>
        </div>

        <footer className="settings-actions">
          {saved && <span className="saved-indicator"><Check size={16} /> Enregistré</span>}
          <button className="primary-button" type="submit" disabled={saving}><Save size={18} />{saving ? "Enregistrement…" : "Enregistrer"}</button>
        </footer>
      </form>
    </section>
  );
}
