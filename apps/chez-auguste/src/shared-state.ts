import { createClient, type RealtimeChannel } from "@supabase/supabase-js";

const SUPABASE_URL = "https://eoewkjfgqivrkkgpjsrk.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_b9sZUgW7Sr2WItAxEqCoyw_gc-xoJyl";
const CLIENT_INSTANCE_ID = typeof crypto.randomUUID === "function"
  ? crypto.randomUUID()
  : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const saveQueues = new Map<SharedSection, Promise<void>>();
let channelSequence = 0;

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
    detectSessionInUrl: false,
    storageKey: "sb-eoewkjfgqivrkkgpjsrk-chez-auguste-auth",
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
  const previousSave = saveQueues.get(section) ?? Promise.resolve();
  const operation = previousSave
    .catch(() => undefined)
    .then(async () => {
      const { data, error } = await supabase
        .from("auguste_shared_state")
        .upsert({
          section,
          payload: { ...payload, _client_instance_id: CLIENT_INSTANCE_ID },
          updated_at: new Date().toISOString(),
          updated_by: userId,
        }, { onConflict: "section" })
        .select("section,payload,updated_at,updated_by")
        .single();

      if (error) throw error;
      return data as SharedRow;
    });
  const queueTail = operation.then(() => undefined, () => undefined);
  saveQueues.set(section, queueTail);
  void queueTail.finally(() => {
    if (saveQueues.get(section) === queueTail) saveQueues.delete(section);
  });
  return operation;
}

export function subscribeToSharedState(
  section: SharedSection,
  onChange: (row: SharedRow) => void,
  onStatus?: (status: string) => void,
): () => void {
  const channel: RealtimeChannel = supabase
    .channel(`chez-auguste:${section}:${CLIENT_INSTANCE_ID}:${++channelSequence}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "auguste_shared_state",
        filter: `section=eq.${section}`,
      },
      (event) => {
        const row = event.new as SharedRow;
        onChange(row);
      },
    )
    .subscribe((status) => onStatus?.(status));

  return () => {
    void supabase.removeChannel(channel);
  };
}

function sortForFingerprint(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortForFingerprint);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => key !== "_client_instance_id")
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entryValue]) => [key, sortForFingerprint(entryValue)]),
  );
}

export function sharedPayloadFingerprint(payload: SharedPayload): string {
  return JSON.stringify(sortForFingerprint(payload));
}

export function isNonEmptyPayload(payload: unknown): payload is SharedPayload {
  return Boolean(
    payload
    && typeof payload === "object"
    && !Array.isArray(payload)
    && Object.keys(payload).length,
  );
}
