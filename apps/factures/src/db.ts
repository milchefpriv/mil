import { supabase } from "./supabase";
import type { Client, DraftInvoice, InvoiceRecord, IssuerProfile } from "./types";
import { defaultProfile, invoiceTotal } from "./utils";

export async function loadWorkspace(userId: string) {
  const [profileResult, clientsResult, invoicesResult, counterResult] = await Promise.all([
    supabase.from("invoice_profiles").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("invoice_clients").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    supabase.from("invoices").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    supabase.from("invoice_counters").select("next_invoice_number,next_credit_number").eq("user_id", userId).maybeSingle(),
  ]);

  if (profileResult.error) throw profileResult.error;
  if (clientsResult.error) throw clientsResult.error;
  if (invoicesResult.error) throw invoicesResult.error;
  if (counterResult.error) throw counterResult.error;

  let profile = profileResult.data as IssuerProfile | null;
  if (!profile) {
    const initial = defaultProfile(userId);
    const { data, error } = await supabase
      .from("invoice_profiles")
      .upsert(initial, { onConflict: "user_id", ignoreDuplicates: true })
      .select()
      .maybeSingle();
    if (error) throw error;
    if (data) {
      profile = data as IssuerProfile;
    } else {
      const { data: existingProfile, error: existingProfileError } = await supabase
        .from("invoice_profiles")
        .select("*")
        .eq("user_id", userId)
        .single();
      if (existingProfileError) throw existingProfileError;
      profile = existingProfile as IssuerProfile;
    }
  }

  return {
    profile,
    clients: (clientsResult.data || []) as Client[],
    invoices: (invoicesResult.data || []) as InvoiceRecord[],
    nextInvoiceNumber: Number(counterResult.data?.next_invoice_number || 2701),
    nextCreditNumber: Number(counterResult.data?.next_credit_number || 1),
  };
}

export async function saveProfile(profile: IssuerProfile) {
  const payload = { ...profile, updated_at: new Date().toISOString() };
  const { data, error } = await supabase
    .from("invoice_profiles")
    .upsert(payload, { onConflict: "user_id" })
    .select()
    .single();
  if (error) throw error;
  return data as IssuerProfile;
}

export async function saveClient(client: Client) {
  const payload = { ...client, updated_at: new Date().toISOString() };
  const { data, error } = await supabase
    .from("invoice_clients")
    .upsert(payload, { onConflict: "id" })
    .select()
    .single();
  if (error) throw error;
  return data as Client;
}

export async function archiveClient(clientId: string, archived = true) {
  const { error } = await supabase
    .from("invoice_clients")
    .update({ archived, updated_at: new Date().toISOString() })
    .eq("id", clientId);
  if (error) throw error;
}

export async function persistDraft(
  draft: DraftInvoice,
  profile: IssuerProfile,
  client: Client | undefined,
  userId: string,
  existing?: InvoiceRecord | null,
) {
  const total = invoiceTotal(draft.lines);
  const payload = {
    id: draft.id,
    user_id: userId,
    document_type: draft.documentType,
    document_code: existing?.document_code || null,
    invoice_number: existing?.invoice_number || null,
    credit_number: existing?.credit_number || null,
    status: existing?.status || "draft",
    issue_date: draft.issueDate,
    service_date: draft.serviceDate,
    due_date: draft.dueDate,
    client_id: client?.id || null,
    client_snapshot: client || null,
    issuer_snapshot: profile,
    sender_email: draft.senderEmail,
    purchase_order: draft.purchaseOrder,
    lines: draft.lines,
    notes: draft.notes,
    total_cents: Math.round(total * 100),
    penalty_rate: profile.penalty_rate,
    source_invoice_id: draft.sourceInvoiceId,
    finalized_at: existing?.finalized_at || null,
    paid_at: existing?.paid_at || null,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase.from("invoices").upsert(payload, { onConflict: "id" }).select().single();
  if (error) throw error;
  return data as InvoiceRecord;
}

export async function finalizeDraft(invoiceId: string) {
  const { data, error } = await supabase.rpc("finalize_invoice_document", { p_invoice_id: invoiceId });
  if (error) throw error;
  return data as string;
}

export async function setInvoiceStatus(invoiceId: string, status: InvoiceRecord["status"]) {
  const { data, error } = await supabase
    .from("invoices")
    .update({ status, paid_at: status === "paid" ? new Date().toISOString() : null, updated_at: new Date().toISOString() })
    .eq("id", invoiceId)
    .select()
    .single();
  if (error) throw error;
  return data as InvoiceRecord;
}

export async function deleteDraft(invoiceId: string) {
  const { error } = await supabase.from("invoices").delete().eq("id", invoiceId).eq("status", "draft");
  if (error) throw error;
}
