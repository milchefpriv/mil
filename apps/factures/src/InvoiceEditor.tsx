import { Eye, FileCheck2, Plus, Save, Trash2, UserPlus } from "lucide-react";
import { useMemo } from "react";

import InvoicePreview from "./InvoicePreview";
import type { Client, DraftInvoice, InvoiceRecord, IssuerProfile, PrintableInvoice } from "./types";
import { addDays, emptyLine, euro, invoiceTotal, lineTotal } from "./utils";

interface Props {
  draft: DraftInvoice;
  profile: IssuerProfile;
  clients: Client[];
  currentRecord: InvoiceRecord | null;
  nextInvoiceNumber: number;
  nextCreditNumber: number;
  saving: boolean;
  finalizing: boolean;
  onChange: (draft: DraftInvoice) => void;
  onNewClient: () => void;
  onSave: () => Promise<void>;
  onFinalize: () => Promise<void>;
  onPreview: (printable: PrintableInvoice) => void;
}

function clientName(client: Client) {
  return client.type === "professional" ? client.company_name || client.contact_name : client.contact_name || client.company_name;
}

function placeholderClient(userId: string): Client {
  return {
    id: "",
    user_id: userId,
    type: "professional",
    company_name: "Client à sélectionner",
    contact_name: "",
    email: "",
    phone: "",
    address: "Adresse",
    postcode: "",
    city: "",
    siren: "",
    billing_address: "",
    archived: false,
  };
}

export function makePrintable(
  draft: DraftInvoice,
  profile: IssuerProfile,
  client: Client | undefined,
  currentRecord: InvoiceRecord | null,
  nextInvoiceNumber: number,
  nextCreditNumber: number,
): PrintableInvoice {
  const draftCode = draft.documentType === "credit"
    ? `AV-${String(nextCreditNumber).padStart(4, "0")}`
    : String(nextInvoiceNumber);
  return {
    documentType: draft.documentType,
    documentCode: currentRecord?.document_code || `${draftCode} · BROUILLON`,
    status: currentRecord?.status || "draft",
    issueDate: draft.issueDate,
    serviceDate: draft.serviceDate,
    dueDate: draft.dueDate,
    senderEmail: draft.senderEmail,
    purchaseOrder: draft.purchaseOrder,
    lines: draft.lines,
    notes: draft.notes,
    total: invoiceTotal(draft.lines),
    penaltyRate: profile.penalty_rate,
    issuer: profile,
    client: client || placeholderClient(profile.user_id),
  };
}

export default function InvoiceEditor(props: Props) {
  const { draft, profile, clients, currentRecord, nextInvoiceNumber, nextCreditNumber } = props;
  const activeClients = clients.filter((client) => !client.archived);
  const selectedClient = activeClients.find((client) => client.id === draft.clientId);
  const total = invoiceTotal(draft.lines);
  const printable = useMemo(
    () => makePrintable(draft, profile, selectedClient, currentRecord, nextInvoiceNumber, nextCreditNumber),
    [currentRecord, draft, nextCreditNumber, nextInvoiceNumber, profile, selectedClient],
  );

  function change<K extends keyof DraftInvoice>(key: K, value: DraftInvoice[K]) {
    props.onChange({ ...draft, [key]: value });
  }

  function changeLine(index: number, key: keyof DraftInvoice["lines"][number], value: string | number) {
    const lines = draft.lines.map((line, lineIndex) => lineIndex === index ? { ...line, [key]: value } : line);
    change("lines", lines);
  }

  function removeLine(index: number) {
    if (draft.lines.length === 1) {
      change("lines", [emptyLine()]);
      return;
    }
    change("lines", draft.lines.filter((_line, lineIndex) => lineIndex !== index));
  }

  const nextCode = draft.documentType === "credit"
    ? `AV-${String(nextCreditNumber).padStart(4, "0")}`
    : String(nextInvoiceNumber);

  return (
    <section className="editor-page">
      <header className="editor-heading">
        <div>
          <span className="eyebrow">{draft.documentType === "credit" ? "NOUVEL AVOIR" : "NOUVELLE FACTURE"}</span>
          <h1>{currentRecord?.document_code || nextCode}</h1>
        </div>
        <button className="secondary-button mobile-preview-button" type="button" onClick={() => props.onPreview(printable)}><Eye size={18} />Aperçu</button>
      </header>

      <div className="editor-layout">
        <div className="editor-form-column">
          <section className="form-card recipient-card">
            <div className="section-heading"><span>01</span><h2>Destinataire</h2></div>
            <div className="recipient-picker-row">
              <label>Client
                <select value={draft.clientId} onChange={(event) => change("clientId", event.target.value)}>
                  <option value="">Sélectionner</option>
                  {activeClients.map((client) => <option value={client.id} key={client.id}>{clientName(client)}</option>)}
                </select>
              </label>
              <button className="secondary-button square" type="button" onClick={props.onNewClient} aria-label="Nouveau client"><UserPlus size={19} /></button>
            </div>
            {selectedClient && (
              <div className="selected-recipient">
                <strong>{clientName(selectedClient)}</strong>
                <span>{selectedClient.address}, {selectedClient.postcode} {selectedClient.city}</span>
              </div>
            )}
          </section>

          <section className="form-card">
            <div className="section-heading"><span>02</span><h2>Dates et référence</h2></div>
            <div className="form-grid three">
              <label>Émission<input type="date" value={draft.issueDate} onChange={(event) => {
                const issueDate = event.target.value;
                props.onChange({ ...draft, issueDate, dueDate: addDays(issueDate, profile.payment_terms_days) });
              }} /></label>
              <label>Prestation<input type="date" value={draft.serviceDate} onChange={(event) => change("serviceDate", event.target.value)} /></label>
              <label>Échéance<input type="date" value={draft.dueDate} onChange={(event) => change("dueDate", event.target.value)} /></label>
            </div>
            <div className="form-grid two">
              <label>E-mail affiché<select value={draft.senderEmail} onChange={(event) => change("senderEmail", event.target.value)}>{profile.emails.filter(Boolean).map((email) => <option key={email}>{email}</option>)}</select></label>
              <label>Bon de commande <small>facultatif</small><input value={draft.purchaseOrder} onChange={(event) => change("purchaseOrder", event.target.value)} placeholder="Référence" /></label>
            </div>
          </section>

          <section className="form-card services-card">
            <div className="section-heading"><span>03</span><h2>Prestations</h2></div>
            <div className="line-editor-head"><span>DÉSIGNATION</span><span>QTÉ</span><span>UNITÉ</span><span>PRIX</span><span>TOTAL</span><i /></div>
            <div className="line-editor-list">
              {draft.lines.map((line, index) => (
                <div className="line-editor" key={line.id}>
                  <label className="line-description"><span>Désignation</span><textarea rows={2} value={line.description} onChange={(event) => changeLine(index, "description", event.target.value)} placeholder="Prestation réalisée" /></label>
                  <label><span>Quantité</span><input type="number" min="0" step="0.01" value={line.quantity} onChange={(event) => changeLine(index, "quantity", Number(event.target.value))} /></label>
                  <label><span>Unité</span><select value={line.unit} onChange={(event) => changeLine(index, "unit", event.target.value)}><option value="heure">Heure</option><option value="journée">Journée</option><option value="prestation">Prestation</option><option value="pièce">Pièce</option><option value="forfait">Forfait</option></select></label>
                  <label><span>Prix unitaire</span><div className="money-input"><input type="number" step="0.01" value={line.unitPrice} onChange={(event) => changeLine(index, "unitPrice", Number(event.target.value))} /><b>€</b></div></label>
                  <strong className="line-total">{euro(lineTotal(line))}</strong>
                  <button className="icon-button muted" type="button" onClick={() => removeLine(index)} aria-label="Supprimer la ligne"><Trash2 size={17} /></button>
                </div>
              ))}
            </div>
            <button className="add-line-button" type="button" onClick={() => change("lines", [...draft.lines, emptyLine()])}><Plus size={17} />Ajouter une ligne</button>
          </section>

          <section className="form-card final-card">
            <div className="section-heading"><span>04</span><h2>Finalisation</h2></div>
            <label>Note <small>facultatif</small><textarea rows={3} value={draft.notes} onChange={(event) => change("notes", event.target.value)} placeholder="Information utile au client" /></label>
            <div className="editor-total"><span>TOTAL TTC · NET À PAYER</span><strong>{euro(total)}</strong></div>
          </section>

          <div className="editor-actions">
            <button className="secondary-button" type="button" disabled={props.saving || props.finalizing} onClick={() => void props.onSave()}><Save size={18} />{props.saving ? "Enregistrement…" : "Enregistrer"}</button>
            <button className="primary-button finalize-button" type="button" disabled={props.saving || props.finalizing} onClick={() => void props.onFinalize()}><FileCheck2 size={18} />{props.finalizing ? "Finalisation…" : "Finaliser et générer"}</button>
          </div>
        </div>

        <aside className="live-preview-column">
          <div className="live-preview-bar"><span>APERÇU A4</span><button className="icon-button" onClick={() => props.onPreview(printable)} aria-label="Agrandir"><Eye size={17} /></button></div>
          <div className="live-preview-stage"><InvoicePreview invoice={printable} /></div>
        </aside>
      </div>
    </section>
  );
}
