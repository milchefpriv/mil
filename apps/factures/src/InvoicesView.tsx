import { CheckCircle2, Copy, Download, FileClock, FilePlus2, MoreHorizontal, Search } from "lucide-react";
import { useMemo, useState } from "react";

import type { InvoiceRecord, InvoiceStatus } from "./types";
import { euro, frenchDate } from "./utils";

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: "Brouillon",
  finalized: "Finalisée",
  sent: "Envoyée",
  paid: "Payée",
  overdue: "En retard",
  credited: "Créditée",
};

function clientName(invoice: InvoiceRecord) {
  const client = invoice.client_snapshot;
  if (!client) return "Client";
  return client.type === "professional" ? client.company_name || client.contact_name : client.contact_name || client.company_name;
}

function effectiveStatus(invoice: InvoiceRecord): InvoiceStatus {
  if (["finalized", "sent"].includes(invoice.status) && invoice.due_date < new Date().toISOString().slice(0, 10)) {
    return "overdue";
  }
  return invoice.status;
}

interface Props {
  invoices: InvoiceRecord[];
  onDownload: (invoice: InvoiceRecord) => void;
  onDuplicate: (invoice: InvoiceRecord) => void;
  onCredit: (invoice: InvoiceRecord) => void;
  onPaid: (invoice: InvoiceRecord) => Promise<void>;
  onEditDraft: (invoice: InvoiceRecord) => void;
}

export default function InvoicesView({ invoices, onDownload, onDuplicate, onCredit, onPaid, onEditDraft }: Props) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | InvoiceStatus>("all");
  const [menu, setMenu] = useState<string | null>(null);

  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return invoices.filter((invoice) => {
      if (filter !== "all" && effectiveStatus(invoice) !== filter) return false;
      if (!needle) return true;
      return [invoice.document_code, clientName(invoice), invoice.total_cents / 100].join(" ").toLocaleLowerCase().includes(needle);
    });
  }, [filter, invoices, query]);

  return (
    <section className="page-view">
      <header className="page-heading"><div><span className="eyebrow">ARCHIVES</span><h1>Factures</h1></div></header>
      <div className="invoice-filters">
        <div className="search-field"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Numéro ou client" /></div>
        <select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}>
          <option value="all">Tous les statuts</option>
          <option value="draft">Brouillons</option>
          <option value="finalized">Finalisées</option>
          <option value="paid">Payées</option>
          <option value="overdue">En retard</option>
          <option value="credited">Créditées</option>
        </select>
      </div>

      {visible.length ? (
        <div className="invoice-list">
          {visible.map((invoice) => {
            const status = effectiveStatus(invoice);
            return (
            <article className="invoice-row" key={invoice.id}>
              <div className={`invoice-status-mark ${status}`}><FileClock size={18} /></div>
              <div className="invoice-id">
                <strong>{invoice.document_code || "BROUILLON"}</strong>
                <span>{frenchDate(invoice.issue_date)}</span>
              </div>
              <div className="invoice-client-name"><strong>{clientName(invoice)}</strong><span>Échéance {frenchDate(invoice.due_date)}</span></div>
              <div className="invoice-status"><span className={`status-pill ${status}`}>{STATUS_LABELS[status]}</span></div>
              <strong className="invoice-amount">{euro(invoice.total_cents / 100)}</strong>
              <div className="invoice-row-actions">
                {invoice.status === "draft" ? (
                  <button className="secondary-button compact" onClick={() => onEditDraft(invoice)}>Ouvrir</button>
                ) : (
                  <button className="icon-button" onClick={() => onDownload(invoice)} aria-label={`Télécharger ${invoice.document_code}`}><Download size={18} /></button>
                )}
                <div className="more-menu-wrap">
                  <button className="icon-button" onClick={() => setMenu(menu === invoice.id ? null : invoice.id)} aria-label="Autres actions"><MoreHorizontal size={19} /></button>
                  {menu === invoice.id && (
                    <div className="more-menu">
                      {invoice.status !== "draft" && invoice.status !== "paid" && <button onClick={() => { void onPaid(invoice); setMenu(null); }}><CheckCircle2 size={16} />Marquer payée</button>}
                      <button onClick={() => { onDuplicate(invoice); setMenu(null); }}><Copy size={16} />Dupliquer</button>
                      {invoice.document_type === "invoice" && invoice.status !== "draft" && invoice.status !== "credited" && <button onClick={() => { onCredit(invoice); setMenu(null); }}><FilePlus2 size={16} />Créer un avoir</button>}
                    </div>
                  )}
                </div>
              </div>
            </article>
            );
          })}
        </div>
      ) : (
        <div className="empty-state"><FileClock size={26} /><h2>Aucune facture</h2><p>Les documents enregistrés apparaîtront ici.</p></div>
      )}
    </section>
  );
}
