import { Building2, UserRound, X } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

import type { Client } from "./types";

interface Props {
  userId: string;
  client: Client | null;
  open: boolean;
  onClose: () => void;
  onSave: (client: Client) => Promise<void>;
}

function emptyClient(userId: string): Client {
  return {
    id: crypto.randomUUID(),
    user_id: userId,
    type: "professional",
    company_name: "",
    contact_name: "",
    email: "",
    phone: "",
    address: "",
    postcode: "",
    city: "",
    siren: "",
    billing_address: "",
    archived: false,
  };
}

export default function ClientDialog({ userId, client, open, onClose, onSave }: Props) {
  const [value, setValue] = useState<Client>(() => client || emptyClient(userId));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setValue(client ? { ...client } : emptyClient(userId));
  }, [client, open, userId]);

  if (!open) return null;

  function update<K extends keyof Client>(key: K, next: Client[K]) {
    setValue((current) => ({ ...current, [key]: next }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await onSave(value);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="dialog-panel" role="dialog" aria-modal="true" aria-labelledby="client-dialog-title">
        <header className="dialog-header">
          <div><span className="eyebrow">RÉPERTOIRE</span><h2 id="client-dialog-title">{client ? "Modifier le client" : "Nouveau client"}</h2></div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Fermer"><X size={20} /></button>
        </header>

        <form className="dialog-form" onSubmit={submit}>
          <div className="segmented-control">
            <button className={value.type === "professional" ? "active" : ""} type="button" onClick={() => update("type", "professional")}>
              <Building2 size={17} /> Entreprise
            </button>
            <button className={value.type === "individual" ? "active" : ""} type="button" onClick={() => update("type", "individual")}>
              <UserRound size={17} /> Particulier
            </button>
          </div>

          <div className="form-grid two">
            {value.type === "professional" && (
              <label>Entreprise<input value={value.company_name} onChange={(e) => update("company_name", e.target.value)} required /></label>
            )}
            <label>{value.type === "professional" ? "Contact" : "Nom complet"}<input value={value.contact_name} onChange={(e) => update("contact_name", e.target.value)} required={value.type === "individual"} /></label>
            {value.type === "professional" && <label>SIREN<input inputMode="numeric" value={value.siren} onChange={(e) => update("siren", e.target.value.replace(/\D/g, "").slice(0, 9))} /></label>}
          </div>

          <div className="form-grid two">
            <label>E-mail<input type="email" value={value.email} onChange={(e) => update("email", e.target.value)} /></label>
            <label>Téléphone<input type="tel" value={value.phone} onChange={(e) => update("phone", e.target.value)} /></label>
          </div>

          <label>Adresse<input value={value.address} onChange={(e) => update("address", e.target.value)} required /></label>
          <div className="form-grid postcode-grid">
            <label>Code postal<input inputMode="numeric" value={value.postcode} onChange={(e) => update("postcode", e.target.value)} required /></label>
            <label>Ville<input value={value.city} onChange={(e) => update("city", e.target.value)} required /></label>
          </div>
          <label>Adresse de facturation <small>si différente</small><input value={value.billing_address} onChange={(e) => update("billing_address", e.target.value)} /></label>

          <footer className="dialog-actions">
            <button className="secondary-button" type="button" onClick={onClose}>Annuler</button>
            <button className="primary-button" type="submit" disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</button>
          </footer>
        </form>
      </section>
    </div>
  );
}
