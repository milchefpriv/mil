import type { PrintableInvoice } from "./types";
import { euro, frenchDate, lineTotal } from "./utils";

function entityName(invoice: PrintableInvoice) {
  const client = invoice.client;
  return client.type === "professional"
    ? client.company_name || client.contact_name
    : client.contact_name || client.company_name;
}

export default function InvoicePreview({ invoice }: { invoice: PrintableInvoice }) {
  const { issuer, client } = invoice;
  const title = invoice.documentType === "credit" ? "AVOIR" : "FACTURE";

  return (
    <article className="invoice-preview" aria-label={`Aperçu ${title.toLowerCase()}`}>
      <div className="preview-accent" />
      <header className="preview-header">
        <div className="preview-brand">
          <strong>{issuer.trade_name || issuer.legal_name || "VOTRE NOM"}</strong>
          {issuer.trade_name && <span>{issuer.legal_name} · EI</span>}
        </div>
        <div className="preview-title">
          <span>{title}</span>
          <strong>{invoice.documentCode || "BROUILLON"}</strong>
          <small>{frenchDate(invoice.issueDate)}</small>
        </div>
      </header>

      <section className="preview-addresses">
        <div>
          <span className="preview-label">ÉMETTEUR</span>
          <strong>{issuer.legal_name || "Nom à compléter"} · EI</strong>
          <p>{issuer.address}<br />{issuer.postcode} {issuer.city}</p>
          <p>{invoice.senderEmail}<br />{issuer.phone}</p>
          <small>SIREN {issuer.siren} · SIRET {issuer.siret}</small>
        </div>
        <div className="preview-client">
          <span className="preview-label">DESTINATAIRE</span>
          <strong>{entityName(invoice) || "Client à sélectionner"}</strong>
          {client.type === "professional" && client.contact_name && client.company_name && (
            <small>{client.contact_name}</small>
          )}
          <p>{client.billing_address || client.address || "Adresse"}<br />{client.postcode} {client.city}</p>
          {client.siren && <small>SIREN {client.siren}</small>}
        </div>
      </section>

      <section className="preview-meta">
        <div><span>PRESTATION</span><strong>{frenchDate(invoice.serviceDate)}</strong></div>
        <div><span>ÉCHÉANCE</span><strong>{frenchDate(invoice.dueDate)}</strong></div>
        {invoice.purchaseOrder && <div><span>RÉFÉRENCE</span><strong>{invoice.purchaseOrder}</strong></div>}
      </section>

      <table className="preview-table">
        <thead>
          <tr><th>DÉSIGNATION</th><th>QTÉ</th><th>PRIX UNIT.</th><th>MONTANT</th></tr>
        </thead>
        <tbody>
          {invoice.lines.map((line) => (
            <tr key={line.id}>
              <td>{line.description || "Description de la prestation"}<small>{line.unit}</small></td>
              <td>{Number(line.quantity || 0).toLocaleString("fr-FR")}</td>
              <td>{euro(line.unitPrice)}</td>
              <td>{euro(lineTotal(line))}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="preview-summary">
        <div className="preview-note">
          {invoice.notes && <><span className="preview-label">NOTE</span><p>{invoice.notes}</p></>}
        </div>
        <div className="preview-totals">
          <div><span>Total HT</span><strong>{euro(invoice.total)}</strong></div>
          <div><span>TVA</span><strong>Non applicable</strong></div>
          <div className="preview-net"><span>TOTAL TTC · NET À PAYER</span><strong>{euro(invoice.total)}</strong></div>
        </div>
      </section>

      <footer className="preview-footer">
        {(issuer.iban || issuer.bic) && (
          <p><strong>RÈGLEMENT</strong>{issuer.iban && <>IBAN {issuer.iban}</>}{issuer.bic && <> · BIC {issuer.bic}</>}</p>
        )}
        <p>TVA non applicable, art. L. 223 et suivants du Code des impositions sur les biens et services (CIBS).</p>
        <p>Escompte pour paiement anticipé : néant.</p>
        {client.type === "professional" && (
          <p>Pénalités de retard : {invoice.penaltyRate.toLocaleString("fr-FR")} % exigibles sans rappel préalable. Indemnité forfaitaire de 40 € pour frais de recouvrement.</p>
        )}
        <span>PRESTATION DE SERVICES</span>
      </footer>
    </article>
  );
}
