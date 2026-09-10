import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { supabase } from "./shared-state";

type OperatorName = "Émile" | "Auguste";

type TraceabilityRecord = {
  id: string;
  captured_at: string;
  updated_at: string;
  photo_path: string;
  barcode: string;
  product_name: string;
  supplier: string;
  lot_number: string;
  expiry_date: string | null;
  quantity: string;
  operator_name: OperatorName;
};

type TraceabilityPanelProps = {
  userId: string;
};

type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => {
  detect(source: ImageBitmapSource): Promise<Array<{ rawValue?: string }>>;
};

const BUCKET = "auguste-traceability";
const OPERATOR_KEY = "auguste-traceability-operator";
const DATE_FORMAT = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" });
const TIME_FORMAT = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });

function recordTitle(record: TraceabilityRecord) {
  return record.product_name.trim() || "Étiquette scannée";
}

function dateKey(value: string) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function relativeDateLabel(value: string) {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (dateKey(value) === dateKey(today.toISOString())) return "Aujourd’hui";
  if (dateKey(value) === dateKey(yesterday.toISOString())) return "Hier";
  return DATE_FORMAT.format(date);
}

async function compressImage(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/") || typeof createImageBitmap !== "function") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const longestSide = Math.max(bitmap.width, bitmap.height);
    const scale = Math.min(1, 1800 / longestSide);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const compressed = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.84));
    return compressed ?? file;
  } catch {
    return file;
  }
}

async function detectBarcode(file: File): Promise<string> {
  const Detector = (window as unknown as { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;
  if (!Detector || typeof createImageBitmap !== "function") return "";
  try {
    const bitmap = await createImageBitmap(file);
    const detector = new Detector();
    const results = await detector.detect(bitmap);
    bitmap.close();
    return results.find((result) => result.rawValue)?.rawValue?.trim() ?? "";
  } catch {
    return "";
  }
}

export default function TraceabilityPanel({ userId }: TraceabilityPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [records, setRecords] = useState<TraceabilityRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedRecord, setSelectedRecord] = useState<TraceabilityRecord | null>(null);
  const [photoUrl, setPhotoUrl] = useState("");
  const [photoLoading, setPhotoLoading] = useState(false);
  const [savingDetails, setSavingDetails] = useState(false);
  const [operator, setOperator] = useState<OperatorName>(() => {
    const saved = window.localStorage.getItem(OPERATOR_KEY);
    return saved === "Auguste" ? "Auguste" : "Émile";
  });

  const loadRecords = useCallback(async () => {
    const { data, error: loadError } = await supabase
      .from("auguste_traceability_records")
      .select("id,captured_at,updated_at,photo_path,barcode,product_name,supplier,lot_number,expiry_date,quantity,operator_name")
      .order("captured_at", { ascending: false })
      .limit(250);
    if (loadError) throw loadError;
    setRecords((data ?? []) as TraceabilityRecord[]);
  }, []);

  useEffect(() => {
    let active = true;
    void loadRecords()
      .catch((loadError) => {
        console.warn("L’historique de traçabilité n’a pas pu être chargé.", loadError);
        if (active) setError("Impossible de charger l’historique pour le moment.");
      })
      .finally(() => { if (active) setLoading(false); });

    const channel = supabase
      .channel(`auguste-traceability:${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "auguste_traceability_records" }, () => {
        if (active) void loadRecords().catch(() => undefined);
      })
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [loadRecords, userId]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(""), 2600);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const groupedRecords = useMemo(() => {
    const groups = new Map<string, TraceabilityRecord[]>();
    records.forEach((record) => {
      const key = dateKey(record.captured_at);
      groups.set(key, [...(groups.get(key) ?? []), record]);
    });
    return [...groups.values()];
  }, [records]);

  const todayCount = useMemo(() => {
    const today = dateKey(new Date().toISOString());
    return records.filter((record) => dateKey(record.captured_at) === today).length;
  }, [records]);

  function selectOperator(name: OperatorName) {
    setOperator(name);
    window.localStorage.setItem(OPERATOR_KEY, name);
  }

  async function scanLabel(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setPendingFile(file);
    setScanning(true);
    setError("");
    try {
      const id = crypto.randomUUID();
      const barcode = await detectBarcode(file);
      const image = await compressImage(file);
      const month = new Date().toISOString().slice(0, 7);
      const photoPath = `${month}/${id}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(photoPath, image, { cacheControl: "3600", contentType: image.type || "image/jpeg", upsert: false });
      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase
        .from("auguste_traceability_records")
        .insert({
          id,
          photo_path: photoPath,
          barcode,
          operator_name: operator,
          recorded_by: userId,
        });
      if (insertError) {
        await supabase.storage.from(BUCKET).remove([photoPath]);
        throw insertError;
      }
      await loadRecords();
      setPendingFile(null);
      setNotice("Étiquette ajoutée ✓");
    } catch (scanError) {
      console.warn("L’étiquette n’a pas pu être enregistrée.", scanError);
      setError("Le scan n’a pas été ajouté. Gardez cette page ouverte et réessayez.");
    } finally {
      setScanning(false);
    }
  }

  async function openRecord(record: TraceabilityRecord) {
    setSelectedRecord({ ...record });
    setPhotoUrl("");
    setPhotoLoading(true);
    const { data, error: signedUrlError } = await supabase.storage.from(BUCKET).createSignedUrl(record.photo_path, 300);
    if (signedUrlError) {
      setError("La photo n’a pas pu être ouverte.");
    } else {
      setPhotoUrl(data.signedUrl);
    }
    setPhotoLoading(false);
  }

  async function saveRecordDetails() {
    if (!selectedRecord) return;
    setSavingDetails(true);
    setError("");
    const { data, error: updateError } = await supabase
      .from("auguste_traceability_records")
      .update({
        product_name: selectedRecord.product_name.trim(),
        supplier: selectedRecord.supplier.trim(),
        lot_number: selectedRecord.lot_number.trim(),
        expiry_date: selectedRecord.expiry_date || null,
        quantity: selectedRecord.quantity.trim(),
        operator_name: selectedRecord.operator_name,
        updated_at: new Date().toISOString(),
      })
      .eq("id", selectedRecord.id)
      .select("id,captured_at,updated_at,photo_path,barcode,product_name,supplier,lot_number,expiry_date,quantity,operator_name")
      .single();
    setSavingDetails(false);
    if (updateError) {
      setError("Les informations n’ont pas pu être enregistrées.");
      return;
    }
    setRecords((current) => current.map((record) => record.id === data.id ? data as TraceabilityRecord : record));
    setSelectedRecord(null);
    setPhotoUrl("");
    setNotice("Informations enregistrées ✓");
  }

  async function deleteRecord() {
    if (!selectedRecord || !window.confirm("Supprimer définitivement cette étiquette ?")) return;
    setSavingDetails(true);
    const record = selectedRecord;
    const { error: deleteError } = await supabase.from("auguste_traceability_records").delete().eq("id", record.id);
    if (deleteError) {
      setSavingDetails(false);
      setError("L’étiquette n’a pas pu être supprimée.");
      return;
    }
    await supabase.storage.from(BUCKET).remove([record.photo_path]);
    setRecords((current) => current.filter((item) => item.id !== record.id));
    setSelectedRecord(null);
    setPhotoUrl("");
    setSavingDetails(false);
    setNotice("Étiquette supprimée");
  }

  return (
    <section className="traceability-page">
      <div className="traceability-hero">
        <div>
          <p className="eyebrow">Hygiène & traçabilité</p>
          <h2>Scanner. C’est rangé.</h2>
        </div>
        <div className="traceability-counter"><strong>{todayCount}</strong><span>aujourd’hui</span></div>
      </div>

      <div className="traceability-scan-card">
        <div className="operator-choice" aria-label="Personne qui scanne">
          <span>Qui scanne ?</span>
          <div>
            {(["Émile", "Auguste"] as OperatorName[]).map((name) => (
              <button key={name} type="button" className={operator === name ? "active" : ""} onClick={() => selectOperator(name)}>{name}</button>
            ))}
          </div>
        </div>
        <button className="scan-label-button" type="button" onClick={() => fileInputRef.current?.click()} disabled={scanning}>
          <span aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M8 12h8" /></svg>
          </span>
          <div><strong>{scanning ? "Enregistrement…" : "Scanner une étiquette"}</strong><small>{scanning ? "La photo est en cours d’ajout" : "La caméra s’ouvre directement"}</small></div>
        </button>
        <input ref={fileInputRef} className="traceability-file-input" type="file" accept="image/*" capture="environment" onChange={scanLabel} />
        {pendingFile && scanning && <p className="scan-pending">Ne fermez pas cette page pendant l’ajout.</p>}
      </div>

      {error && <div className="traceability-feedback error" role="alert"><span>!</span><p>{error}</p><button type="button" onClick={() => setError("")} aria-label="Fermer">×</button></div>}

      <div className="traceability-history-heading">
        <div><p className="eyebrow">Historique</p><h3>Étiquettes enregistrées</h3></div>
        <span>{records.length} au total</span>
      </div>

      {loading ? <div className="traceability-empty">Chargement…</div> : records.length ? (
        <div className="traceability-history">
          {groupedRecords.map((group) => (
            <section className="traceability-day" key={dateKey(group[0].captured_at)}>
              <div className="traceability-day-heading"><strong>{relativeDateLabel(group[0].captured_at)}</strong><span>{group.length}</span></div>
              <div className="traceability-records">
                {group.map((record) => (
                  <button type="button" className="traceability-record" key={record.id} onClick={() => void openRecord(record)}>
                    <span className="traceability-record-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24"><path d="M7 3h10l3 3v15H4V3h3Zm1 5h8M8 12h8M8 16h5" /></svg>
                    </span>
                    <span className="traceability-record-copy">
                      <strong>{recordTitle(record)}</strong>
                      <small>{TIME_FORMAT.format(new Date(record.captured_at))} · {record.operator_name}{record.supplier ? ` · ${record.supplier}` : ""}</small>
                      {(record.lot_number || record.expiry_date || record.barcode) && <span>{record.lot_number ? `Lot ${record.lot_number}` : record.barcode ? `Code ${record.barcode}` : ""}{record.expiry_date ? `${record.lot_number || record.barcode ? " · " : ""}Date ${new Intl.DateTimeFormat("fr-FR").format(new Date(`${record.expiry_date}T12:00:00`))}` : ""}</span>}
                    </span>
                    <b aria-hidden="true">›</b>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : <div className="traceability-empty"><strong>Aucune étiquette</strong><span>Le premier scan apparaîtra ici.</span></div>}

      {selectedRecord && (
        <div className="modal-backdrop traceability-backdrop" role="presentation" onMouseDown={() => setSelectedRecord(null)}>
          <section className="traceability-detail" role="dialog" aria-modal="true" aria-labelledby="traceability-detail-title" onMouseDown={(event) => event.stopPropagation()}>
            <button type="button" className="modal-close" onClick={() => setSelectedRecord(null)} aria-label="Fermer">×</button>
            <p className="eyebrow">Étiquette du {DATE_FORMAT.format(new Date(selectedRecord.captured_at))}</p>
            <h2 id="traceability-detail-title">{recordTitle(selectedRecord)}</h2>
            <button className="traceability-photo" type="button" onClick={() => photoUrl && window.open(photoUrl, "_blank", "noopener,noreferrer")} disabled={!photoUrl}>
              {photoLoading ? <span>Ouverture de la photo…</span> : photoUrl ? <img src={photoUrl} alt="Étiquette de traçabilité" /> : <span>Photo indisponible</span>}
            </button>
            <div className="traceability-form">
              <label className="wide"><span>Produit</span><input value={selectedRecord.product_name} onChange={(event) => setSelectedRecord({ ...selectedRecord, product_name: event.target.value })} placeholder="Ex. Filet de saumon" /></label>
              <label><span>Fournisseur</span><input value={selectedRecord.supplier} onChange={(event) => setSelectedRecord({ ...selectedRecord, supplier: event.target.value })} placeholder="Nom du fournisseur" /></label>
              <label><span>Quantité</span><input value={selectedRecord.quantity} onChange={(event) => setSelectedRecord({ ...selectedRecord, quantity: event.target.value })} placeholder="Ex. 5 kg" /></label>
              <label><span>Numéro de lot</span><input value={selectedRecord.lot_number} onChange={(event) => setSelectedRecord({ ...selectedRecord, lot_number: event.target.value })} placeholder="Lot" /></label>
              <label><span>DLC / DDM</span><input type="date" value={selectedRecord.expiry_date ?? ""} onChange={(event) => setSelectedRecord({ ...selectedRecord, expiry_date: event.target.value || null })} /></label>
              {selectedRecord.barcode && <div className="traceability-barcode wide"><span>Code détecté</span><strong>{selectedRecord.barcode}</strong></div>}
              <fieldset className="traceability-operator-field wide"><legend>Enregistré par</legend><div>{(["Émile", "Auguste"] as OperatorName[]).map((name) => <button type="button" key={name} className={selectedRecord.operator_name === name ? "active" : ""} onClick={() => setSelectedRecord({ ...selectedRecord, operator_name: name })}>{name}</button>)}</div></fieldset>
            </div>
            <div className="traceability-detail-actions">
              <button className="traceability-delete" type="button" onClick={() => void deleteRecord()} disabled={savingDetails}>Supprimer</button>
              <button className="primary-button" type="button" onClick={() => void saveRecordDetails()} disabled={savingDetails}>{savingDetails ? "Enregistrement…" : "Enregistrer"}</button>
            </div>
          </section>
        </div>
      )}

      {notice && <div className="toast" role="status">{notice}</div>}
    </section>
  );
}
