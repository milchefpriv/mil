import { Archive, Building2, Mail, MapPin, Pencil, Plus, Search, UserRound } from "lucide-react";
import { useMemo, useState } from "react";

import type { Client } from "./types";

interface Props {
  clients: Client[];
  onNew: () => void;
  onEdit: (client: Client) => void;
  onArchive: (client: Client) => Promise<void>;
}

function name(client: Client) {
  return client.type === "professional" ? client.company_name || client.contact_name : client.contact_name || client.company_name;
}

export default function ClientsView({ clients, onNew, onEdit, onArchive }: Props) {
  const [query, setQuery] = useState("");
  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return clients.filter((client) => {
      if (client.archived) return false;
      if (!needle) return true;
      return [client.company_name, client.contact_name, client.email, client.city, client.siren]
        .join(" ")
        .toLocaleLowerCase()
        .includes(needle);
    });
  }, [clients, query]);

  return (
    <section className="page-view">
      <header className="page-heading">
        <div><span className="eyebrow">RÉPERTOIRE</span><h1>Clients</h1></div>
        <button className="primary-button" type="button" onClick={onNew}><Plus size={18} />Ajouter</button>
      </header>

      <div className="search-field"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher un client" /></div>

      {visible.length ? (
        <div className="client-grid">
          {visible.map((client) => (
            <article className="client-card" key={client.id}>
              <div className="client-icon">{client.type === "professional" ? <Building2 size={19} /> : <UserRound size={19} />}</div>
              <div className="client-card-main">
                <span>{client.type === "professional" ? "ENTREPRISE" : "PARTICULIER"}</span>
                <h2>{name(client)}</h2>
                {client.type === "professional" && client.contact_name && <p>{client.contact_name}</p>}
                <p><MapPin size={14} />{client.postcode} {client.city}</p>
                {client.email && <p><Mail size={14} />{client.email}</p>}
                {client.siren && <small>SIREN {client.siren}</small>}
              </div>
              <div className="client-actions">
                <button className="icon-button" type="button" onClick={() => onEdit(client)} aria-label={`Modifier ${name(client)}`}><Pencil size={17} /></button>
                <button className="icon-button muted" type="button" onClick={() => void onArchive(client)} aria-label={`Archiver ${name(client)}`}><Archive size={17} /></button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state"><Building2 size={26} /><h2>Aucun client</h2><p>Ajoute ton premier destinataire.</p><button className="primary-button" onClick={onNew}><Plus size={18} />Ajouter un client</button></div>
      )}
    </section>
  );
}
