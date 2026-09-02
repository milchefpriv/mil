import type { DraftInvoice, InvoiceLine, InvoiceRecord, IssuerProfile } from "./types";

export const DEFAULT_EMAILS = [
  "mil.chef.priv@gmail.com",
  "eliasemileobeid@gmail.com",
  "remileobeid@gmail.com",
];

export function defaultProfile(userId: string): IssuerProfile {
  return {
    user_id: userId,
    legal_name: "Émile Obeid",
    trade_name: "",
    siren: "902875749",
    siret: "90287574900019",
    address: "3 avenue Frédéric Roustan",
    postcode: "92600",
    city: "Asnières-sur-Seine",
    phone: "06 24 73 26 59",
    emails: DEFAULT_EMAILS,
    default_email: DEFAULT_EMAILS[0],
    iban: "",
    bic: "",
    payment_terms_days: 30,
    penalty_rate: 12.4,
  };
}

export function isoToday() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export function addDays(date: string, days: number) {
  const parsed = new Date(`${date}T12:00:00`);
  parsed.setDate(parsed.getDate() + days);
  return parsed.toISOString().slice(0, 10);
}

export function emptyLine(): InvoiceLine {
  return {
    id: crypto.randomUUID(),
    description: "",
    quantity: 1,
    unit: "prestation",
    unitPrice: 0,
  };
}

export function newDraft(profile: IssuerProfile): DraftInvoice {
  const today = isoToday();
  return {
    id: crypto.randomUUID(),
    documentType: "invoice",
    clientId: "",
    issueDate: today,
    serviceDate: today,
    dueDate: addDays(today, profile.payment_terms_days),
    senderEmail: profile.default_email || profile.emails[0] || "",
    purchaseOrder: "",
    lines: [emptyLine()],
    notes: "",
    sourceInvoiceId: null,
  };
}

export function lineTotal(line: InvoiceLine) {
  return Math.round((Number(line.quantity) || 0) * (Number(line.unitPrice) || 0) * 100) / 100;
}

export function invoiceTotal(lines: InvoiceLine[]) {
  return Math.round(lines.reduce((sum, line) => sum + lineTotal(line), 0) * 100) / 100;
}

export function euro(value: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(value || 0);
}

export function shortEuro(value: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

export function frenchDate(value: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

export function recordToDraft(invoice: InvoiceRecord): DraftInvoice {
  return {
    id: crypto.randomUUID(),
    documentType: invoice.document_type,
    clientId: invoice.client_id || "",
    issueDate: isoToday(),
    serviceDate: isoToday(),
    dueDate: addDays(isoToday(), invoice.issuer_snapshot?.payment_terms_days || 30),
    senderEmail: invoice.sender_email,
    purchaseOrder: "",
    lines: invoice.lines.map((line) => ({ ...line, id: crypto.randomUUID() })),
    notes: invoice.notes,
    sourceInvoiceId: null,
  };
}

export function fileSlug(value: string) {
  return String(value || "document")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "document";
}
