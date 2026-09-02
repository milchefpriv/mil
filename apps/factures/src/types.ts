export type ViewName = "new" | "invoices" | "clients" | "settings";
export type ClientType = "professional" | "individual";
export type InvoiceStatus = "draft" | "finalized" | "sent" | "paid" | "overdue" | "credited";
export type DocumentType = "invoice" | "credit";

export interface IssuerProfile {
  user_id: string;
  legal_name: string;
  trade_name: string;
  siren: string;
  siret: string;
  address: string;
  postcode: string;
  city: string;
  phone: string;
  emails: string[];
  default_email: string;
  iban: string;
  bic: string;
  payment_terms_days: number;
  penalty_rate: number;
  updated_at?: string;
}

export interface Client {
  id: string;
  user_id: string;
  type: ClientType;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string;
  address: string;
  postcode: string;
  city: string;
  siren: string;
  billing_address: string;
  archived: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface InvoiceLine {
  id: string;
  description: string;
  quantity: number;
  unit: "heure" | "journée" | "prestation" | "pièce" | "forfait";
  unitPrice: number;
}

export interface InvoiceRecord {
  id: string;
  user_id: string;
  document_type: DocumentType;
  document_code: string | null;
  invoice_number: number | null;
  credit_number: number | null;
  status: InvoiceStatus;
  issue_date: string;
  service_date: string;
  due_date: string;
  client_id: string | null;
  client_snapshot: Client | null;
  issuer_snapshot: IssuerProfile | null;
  sender_email: string;
  purchase_order: string;
  lines: InvoiceLine[];
  notes: string;
  total_cents: number;
  penalty_rate: number;
  source_invoice_id: string | null;
  finalized_at: string | null;
  paid_at: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface DraftInvoice {
  id: string;
  documentType: DocumentType;
  clientId: string;
  issueDate: string;
  serviceDate: string;
  dueDate: string;
  senderEmail: string;
  purchaseOrder: string;
  lines: InvoiceLine[];
  notes: string;
  sourceInvoiceId: string | null;
}

export interface PrintableInvoice {
  documentType: DocumentType;
  documentCode: string;
  status: InvoiceStatus;
  issueDate: string;
  serviceDate: string;
  dueDate: string;
  senderEmail: string;
  purchaseOrder: string;
  lines: InvoiceLine[];
  notes: string;
  total: number;
  penaltyRate: number;
  issuer: IssuerProfile;
  client: Client;
}
