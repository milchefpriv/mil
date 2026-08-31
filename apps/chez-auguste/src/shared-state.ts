import { createClient, type RealtimeChannel } from "@supabase/supabase-js";

const SUPABASE_URL = "https://eoewkjfgqivrkkgpjsrk.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_b9sZUgW7Sr2WItAxEqCoyw_gc-xoJyl";

export type SharedSection = "cuisine" | "bar";
export type SharedPayload = Record<string, unknown>;

type SharedRow = {
  section: SharedSection;
  payload: SharedPayload;
  updated_at: string;
  updated_by: string | null;
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export async function loadSharedState(section: SharedSection): Promise<SharedRow | null> {
  const { data, error } = await supabase
    .from("auguste_shared_state")
    .select("section,payload,updated_at,updated_by")
    .eq("section", section)
    .maybeSingle();

  if (error) throw error;
  return data as SharedRow | null;
}

export async function saveSharedState(
  section: SharedSection,
  payload: SharedPayload,
  userId: string,
): Promise<SharedRow> {
  const { data, error } = await supabase
    .from("auguste_shared_state")
    .upsert({
      section,
      payload,
      updated_at: new Date().toISOString(),
      updated_by: userId,
    }, { onConflict: "section" })
    .select("section,payload,updated_at,updated_by")
    .single();

  if (error) throw error;
  return data as SharedRow;
}

export function subscribeToSharedState(
  section: SharedSection,
  onChange: (row: SharedRow) => void,
  onStatus?: (status: string) => void,
): () => void {
  const channel: RealtimeChannel = supabase
    .channel(`chez-auguste:${section}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "auguste_shared_state",
        filter: `section=eq.${section}`,
      },
      (event) => onChange(event.new as SharedRow),
    )
    .subscribe((status) => onStatus?.(status));

  return () => {
    void supabase.removeChannel(channel);
  };
}

export function isNonEmptyPayload(payload: unknown): payload is SharedPayload {
  return Boolean(
    payload
    && typeof payload === "object"
    && !Array.isArray(payload)
    && Object.keys(payload).length,
  );
}
