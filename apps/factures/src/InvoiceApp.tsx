import {
  ArrowUpRight,
  BookUser,
  ChevronRight,
  FilePlus2,
  FileText,
  LogOut,
  Menu,
  ReceiptText,
  Settings,
  WalletCards,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import ClientDialog from "./ClientDialog";
import ClientsView from "./ClientsView";
import {
  archiveClient,
  finalizeDraft,
  loadWorkspace,
  persistDraft,
  saveClient,
  saveProfile,
  setInvoiceStatus,
} from "./db";
import InvoiceEditor, { makePrintable } from "./InvoiceEditor";
import InvoicePreview from "./InvoicePreview";
import InvoicesView from "./InvoicesView";
import { downloadInvoicePdf } from "./invoice-pdf";
import SettingsView from "./SettingsView";
import type { Client, DraftInvoice, InvoiceRecord, IssuerProfile, PrintableInvoice, ViewName } from "./types";
import { defaultProfile, invoiceTotal, isoToday, newDraft, recordToDraft, shortEuro } from "./utils";

interface Props {
  user: { id: string; email: string };
  onSignOut: () => void;
}

const NAV: Array<{ id: ViewName; label: string; icon: typeof FileText }> = [
  { id: "new", label: "Nouvelle", icon: FilePlus2 },
  { id: "invoices", label: "Factures", icon: ReceiptText },
  { id: "clients", label: "Clients", icon: BookUser },
  { id: "settings", label: "Paramètres", icon: Settings },
];

function printableFromRecord(invoice: InvoiceRecord, fallbackProfile: IssuerProfile): PrintableInvoice | null {
  if (!invoice.client_snapshot) return null;
  return {
    documentType: invoice.document_type,
    documentCode: invoice.document_code || "BROUILLON",
    status: invoice.status,
    issueDate: invoice.issue_date,
    serviceDate: invoice.service_date,
    dueDate: invoice.due_date,
    senderEmail: invoice.sender_email,
    purchaseOrder: invoice.purchase_order,
    lines: invoice.lines,
    notes: invoice.notes,
    total: invoice.total_cents / 100,
    penaltyRate: invoice.penalty_rate,
    issuer: invoice.issuer_snapshot || fallbackProfile,
    client: invoice.client_snapshot,
  };
}

export default function InvoiceApp({ user, onSignOut }: Props) {
  const [view, setView] = useState<ViewName>("new");
  const [profile, setProfile] = useState<IssuerProfile>(() => defaultProfile(user.id));
  const [clients, setClients] = useState<Client[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [nextInvoiceNumber, setNextInvoiceNumber] = useState(2701);
  const [nextCreditNumber, setNextCreditNumber] = useState(1);
  const [draft, setDraft] = useState<DraftInvoice>(() => newDraft(defaultProfile(user.id)));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [preview, setPreview] = useState<PrintableInvoice | null>(null);
  const [clientDialog, setClientDialog] = useState<{ open: boolean; client: Client | null; selectAfterSave: boolean }>({ open: false, client: null, selectAfterSave: false });

  async function refresh(resetDraft = false) {
    const workspace = await loadWorkspace(user.id);
    setProfile(workspace.profile);
    setClients(workspace.clients);
    setInvoices(workspace.invoices);
    setNextInvoiceNumber(workspace.nextInvoiceNumber);
    setNextCreditNumber(workspace.nextCreditNumber);
    if (resetDraft) setDraft(newDraft(workspace.profile));
    return workspace;
  }

  useEffect(() => {
    let active = true;
    void refresh(true)
      .catch(() => active && toast.error("Les données n’ont pas pu être chargées."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const currentRecord = useMemo(() => invoices.find((invoice) => invoice.id === draft.id) || null, [draft.id, invoices]);
  const finalizedInvoices = invoices.filter((invoice) => invoice.status !== "draft" && invoice.document_type === "invoice");
  const dueTotal = finalizedInvoices.filter((invoice) => !["paid", "credited"].includes(invoice.status)).reduce((sum, invoice) => sum + invoice.total_cents, 0) / 100;
  const overdueTotal = finalizedInvoices.filter((invoice) => !["paid", "credited"].includes(invoice.status) && invoice.due_date < isoToday()).reduce((sum, invoice) => sum + invoice.total_cents, 0) / 100;
  const monthKey = isoToday().slice(0, 7);
  const paidThisMonth = finalizedInvoices.filter((invoice) => invoice.status === "paid" && invoice.paid_at?.startsWith(monthKey)).reduce((sum, invoice) => sum + invoice.total_cents, 0) / 100;

  function navigate(next: ViewName) {
    setView(next);
    setMobileMenu(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function startNew() {
    setDraft(newDraft(profile));
    navigate("new");
  }

  async function handleSaveDraft() {
    setSaving(true);
    try {
      const client = clients.find((item) => item.id === draft.clientId);
      const saved = await persistDraft(draft, profile, client, user.id, currentRecord);
      setInvoices((items) => [saved, ...items.filter((item) => item.id !== saved.id)]);
      toast.success("Brouillon enregistré");
    } catch {
      toast.error("Le brouillon n’a pas pu être enregistré.");
      throw new Error("draft-save-failed");
    } finally {
      setSaving(false);
    }
  }

  function validateDraft() {
    if (!profile.legal_name.trim()) return "Renseigne ton nom légal dans les paramètres.";
    if (!draft.clientId) return "Sélectionne un destinataire.";
    if (!draft.issueDate || !draft.serviceDate || !draft.dueDate) return "Renseigne les trois dates.";
    if (draft.lines.some((line) => !line.description.trim())) return "Ajoute une désignation à chaque ligne.";
    const total = invoiceTotal(draft.lines);
    if (draft.documentType === "invoice" && total <= 0) return "Le montant de la facture doit être supérieur à zéro.";
    if (draft.documentType === "credit" && total >= 0) return "Le montant de l’avoir doit être négatif.";
    return "";
  }

  async function handleFinalize() {
    const validation = validateDraft();
    if (validation) {
      toast.error(validation);
      return;
    }

    setFinalizing(true);
    try {
      const client = clients.find((item) => item.id === draft.clientId)!;
      const saved = await persistDraft(draft, profile, client, user.id, currentRecord);
      const code = await finalizeDraft(saved.id);
      const workspace = await refresh(false);
      const finalized = workspace.invoices.find((invoice) => invoice.id === saved.id);
      if (!finalized) throw new Error("finalized-document-not-found");
      const printable = printableFromRecord(finalized, workspace.profile);
      if (!printable) throw new Error("printable-document-invalid");
      downloadInvoicePdf(printable);
      toast.success(`${finalized.document_type === "credit" ? "Avoir" : "Facture"} ${code} finalisé${finalized.document_type === "credit" ? "" : "e"}`);
      setDraft(newDraft(workspace.profile));
      setView("invoices");
    } catch {
      toast.error("La finalisation a échoué. Aucun numéro n’a été perdu.");
    } finally {
      setFinalizing(false);
    }
  }

  async function handleClientSave(client: Client) {
    try {
      const saved = await saveClient(client);
      setClients((items) => [saved, ...items.filter((item) => item.id !== saved.id)]);
      if (clientDialog.selectAfterSave) setDraft((current) => ({ ...current, clientId: saved.id }));
      toast.success("Client enregistré");
    } catch {
      toast.error("Le client n’a pas pu être enregistré.");
      throw new Error("client-save-failed");
    }
  }

  async function handleArchiveClient(client: Client) {
    try {
      await archiveClient(client.id, true);
      setClients((items) => items.map((item) => item.id === client.id ? { ...item, archived: true } : item));
      toast.success("Client archivé");
    } catch {
      toast.error("Archivage impossible.");
    }
  }

  async function handleProfileSave(next: IssuerProfile) {
    try {
      const saved = await saveProfile(next);
      setProfile(saved);
      toast.success("Paramètres enregistrés");
    } catch {
      toast.error("Les paramètres n’ont pas pu être enregistrés.");
      throw new Error("profile-save-failed");
    }
  }

  function handleDownload(invoice: InvoiceRecord) {
    const printable = printableFromRecord(invoice, profile);
    if (!printable) return toast.error("Ce document est incomplet.");
    downloadInvoicePdf(printable);
  }

  function handleDuplicate(invoice: InvoiceRecord) {
    setDraft({ ...recordToDraft(invoice), documentType: "invoice" });
    navigate("new");
  }

  function handleCredit(invoice: InvoiceRecord) {
    const duplicated = recordToDraft(invoice);
    setDraft({
      ...duplicated,
      documentType: "credit",
      clientId: invoice.client_id || "",
      sourceInvoiceId: invoice.id,
      lines: invoice.lines.map((line) => ({ ...line, id: crypto.randomUUID(), unitPrice: -Math.abs(line.unitPrice) })),
      notes: `Avoir lié à la facture ${invoice.document_code}`,
    });
    navigate("new");
  }

  async function handlePaid(invoice: InvoiceRecord) {
    try {
      const saved = await setInvoiceStatus(invoice.id, "paid");
      setInvoices((items) => items.map((item) => item.id === saved.id ? saved : item));
      toast.success(`${invoice.document_code} marquée payée`);
    } catch {
      toast.error("La facture n’a pas pu être mise à jour.");
    }
  }

  function editDraft(invoice: InvoiceRecord) {
    setDraft({ ...recordToDraft(invoice), id: invoice.id, clientId: invoice.client_id || "", documentType: invoice.document_type, sourceInvoiceId: invoice.source_invoice_id });
    navigate("new");
  }

  if (loading) {
    return <main className="loading-screen"><span className="brand-seal"><FileText size={22} /></span><span className="loading-line" /></main>;
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileMenu ? "open" : ""}`}>
        <div className="sidebar-brand"><span className="brand-seal"><FileText size={21} /></span><strong>FACTURES</strong><button className="icon-button sidebar-close" onClick={() => setMobileMenu(false)}><X size={20} /></button></div>
        <nav>
          {NAV.map((item) => {
            const Icon = item.icon;
            return <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => navigate(item.id)}><Icon size={19} /><span>{item.label}</span>{view === item.id && <ChevronRight size={15} />}</button>;
          })}
        </nav>
        <div className="sidebar-account"><span>{user.email.slice(0, 1).toUpperCase()}</span><div><strong>Émile</strong><small>{user.email}</small></div><button className="icon-button" onClick={onSignOut} aria-label="Se déconnecter"><LogOut size={17} /></button></div>
      </aside>
      {mobileMenu && <button className="mobile-overlay" onClick={() => setMobileMenu(false)} aria-label="Fermer le menu" />}

      <main className="app-main">
        <header className="mobile-topbar"><button className="icon-button" onClick={() => setMobileMenu(true)}><Menu size={21} /></button><strong>FACTURES</strong><button className="new-mobile-button" onClick={startNew}><FilePlus2 size={19} /></button></header>

        {view !== "new" && view !== "settings" && (
          <section className="metric-strip">
            <div><span>À ENCAISSER</span><strong>{shortEuro(dueTotal)}</strong><WalletCards size={18} /></div>
            <div className={overdueTotal > 0 ? "alert" : ""}><span>EN RETARD</span><strong>{shortEuro(overdueTotal)}</strong><ArrowUpRight size={18} /></div>
            <div><span>ENCAISSÉ CE MOIS</span><strong>{shortEuro(paidThisMonth)}</strong><ReceiptText size={18} /></div>
          </section>
        )}

        {view === "new" && (
          <InvoiceEditor
            draft={draft}
            profile={profile}
            clients={clients}
            currentRecord={currentRecord}
            nextInvoiceNumber={nextInvoiceNumber}
            nextCreditNumber={nextCreditNumber}
            saving={saving}
            finalizing={finalizing}
            onChange={setDraft}
            onNewClient={() => setClientDialog({ open: true, client: null, selectAfterSave: true })}
            onSave={handleSaveDraft}
            onFinalize={handleFinalize}
            onPreview={setPreview}
          />
        )}
        {view === "invoices" && <InvoicesView invoices={invoices} onDownload={handleDownload} onDuplicate={handleDuplicate} onCredit={handleCredit} onPaid={handlePaid} onEditDraft={editDraft} />}
        {view === "clients" && <ClientsView clients={clients} onNew={() => setClientDialog({ open: true, client: null, selectAfterSave: false })} onEdit={(client) => setClientDialog({ open: true, client, selectAfterSave: false })} onArchive={handleArchiveClient} />}
        {view === "settings" && <SettingsView profile={profile} onSave={handleProfileSave} />}
      </main>

      <ClientDialog userId={user.id} client={clientDialog.client} open={clientDialog.open} onClose={() => setClientDialog((current) => ({ ...current, open: false }))} onSave={handleClientSave} />
      {preview && (
        <div className="dialog-backdrop preview-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setPreview(null)}>
          <section className="preview-dialog" role="dialog" aria-modal="true" aria-label="Aperçu de la facture">
            <div className="preview-dialog-bar"><span>APERÇU A4</span><button className="icon-button" onClick={() => setPreview(null)}><X size={20} /></button></div>
            <div className="preview-dialog-stage"><InvoicePreview invoice={preview} /></div>
          </section>
        </div>
      )}
    </div>
  );
}
