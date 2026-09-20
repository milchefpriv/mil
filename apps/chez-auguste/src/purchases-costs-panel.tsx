"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./shared-state";
import "./purchases-costs-panel.css";

type PurchasesView = "overview" | "products" | "invoices";
type ProductCategory = "food" | "beverage" | "non_food";
type DbRow = Record<string, unknown>;

type SupplierInvoice = {
  id: string;
  workspaceId: string;
  supplier: string;
  invoiceNumber: string;
  issueDate: string;
  importedAt: string;
  totalHt: number | null;
  totalTtc: number | null;
  status: string;
  documentType: string;
};

type SupplierInvoiceLine = {
  id: string;
  invoiceId: string;
  productId: string;
  description: string;
  supplierReference: string;
  quantity: number | null;
  unit: string;
  unitPriceHt: number | null;
  totalHt: number | null;
  category: ProductCategory;
  observedAt: string;
  createdAt: string;
  lineNumber: number;
  mappingStatus: string;
};

type SupplierProduct = {
  id: string;
  workspaceId: string;
  name: string;
  supplier: string;
  supplierReference: string;
  category: ProductCategory;
  unit: string;
  currentPriceHt: number | null;
  previousPriceHt: number | null;
  updatedAt: string;
  conversionStatus: string;
};

type PricePoint = {
  date: string;
  price: number;
  invoiceId: string;
  sortKey: string;
};

type ProductTrend = SupplierProduct & {
  history: PricePoint[];
  currentPriceHt: number | null;
  previousPriceHt: number | null;
  variationPercent: number | null;
  updatedAt: string;
};

type PurchasesSnapshot = {
  invoices: DbRow[];
  lines: DbRow[];
  products: DbRow[];
};

const TABLES = {
  invoices: "auguste_supplier_invoices",
  lines: "auguste_supplier_invoice_lines",
  products: "auguste_supplier_products",
} as const;
const WORKSPACE_ID = "a617e000-0000-4000-8000-000000000001";

const CATEGORY_LABELS: Record<ProductCategory, string> = {
  food: "Cuisine",
  beverage: "Boissons",
  non_food: "Non alimentaire",
};

const euro = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const compactEuro = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  notation: "compact",
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});
const dateFormat = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" });
const monthFormat = new Intl.DateTimeFormat("fr-FR", { month: "short", year: "2-digit" });

function firstValue(row: DbRow, keys: string[]): unknown {
  for (const key of keys) {
    const value = row[key];
    if (value !== null && value !== undefined && value !== "") return value;
  }
  return undefined;
}

function readString(row: DbRow, keys: string[], fallback = ""): string {
  const value = firstValue(row, keys);
  if (typeof value === "string") return value.trim() || fallback;
  if (typeof value === "number") return String(value);
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const nested = value as DbRow;
    return readString(nested, ["name", "label", "display_name"], fallback);
  }
  return fallback;
}

function readNumber(row: DbRow, keys: string[]): number | null {
  const value = firstValue(row, keys);
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string" || !value.trim()) return null;
  const normalized = value.replace(/\s/g, "").replace(",", ".").replace(/[^0-9+-.]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function readDate(row: DbRow, keys: string[]): string {
  const value = readString(row, keys);
  return value && !Number.isNaN(Date.parse(value)) ? new Date(value).toISOString() : "";
}

function normalizeSearch(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr-FR").trim();
}

function inferCategory(value: unknown, productName = ""): ProductCategory {
  const category = normalizeSearch(typeof value === "string" ? value : "");
  if (["beverage", "beverages", "drink", "drinks", "boisson", "boissons", "bar"].includes(category)) return "beverage";
  if (["non_food", "non-food", "non food", "packaging", "consumable", "consommable", "emballage", "entretien", "hygiene"].includes(category)) return "non_food";
  if (["food", "ingredient", "ingredients", "alimentaire", "cuisine"].includes(category)) return "food";

  const name = normalizeSearch(productName);
  if (/\b(eau|biere|vin|champagne|cidre|limonade|tonic|soda|coca|jus|sirop)\b/.test(name)) return "beverage";
  if (/\b(serviette|essuie|papier|vaisselle|poubelle|detergent|nettoy|emballage|barquette|gobelet|gant|eponge|film alimentaire|aluminium)\b/.test(name)) return "non_food";
  return "food";
}

function normalizeInvoice(row: DbRow, index: number): SupplierInvoice {
  return {
    id: readString(row, ["id"], `invoice-${index}`),
    workspaceId: readString(row, ["workspace_id"]),
    supplier: readString(row, ["supplier_name", "supplier", "auguste_suppliers", "vendor_name", "issuer_name"], "Fournisseur"),
    invoiceNumber: readString(row, ["normalized_invoice_number", "invoice_number", "number", "reference"], "Sans numéro"),
    issueDate: readDate(row, ["issue_date", "invoice_date", "date", "issued_at"]),
    importedAt: readDate(row, ["imported_at", "received_at", "created_at", "updated_at"]),
    totalHt: readNumber(row, ["total_ht", "subtotal_ht", "net_amount_ht", "amount_ht"]),
    totalTtc: readNumber(row, ["total_ttc", "gross_amount", "amount_ttc", "total"]),
    status: readString(row, ["status", "processing_status", "extraction_status"], "parsed"),
    documentType: readString(row, ["document_type", "type"], "invoice"),
  };
}

function normalizeLine(row: DbRow, index: number): SupplierInvoiceLine {
  const description = readString(row, ["description", "raw_description", "label", "product_name", "name"], "Produit sans libellé");
  const quantity = readNumber(row, ["quantity", "invoice_quantity", "qty"]);
  const totalHt = readNumber(row, ["net_line_amount_ht", "line_total_ht", "total_ht", "amount_ht"]);
  // The printed supplier price is the comparison source of truth. Effective
  // prices can move slightly on variable-weight lines because of rounding.
  const explicitUnitPrice = readNumber(row, ["displayed_unit_price_ht", "unit_price_ht", "net_unit_price_ht", "price_ht"]);
  const unitPriceHt = explicitUnitPrice ?? (totalHt !== null && quantity && quantity > 0 ? totalHt / quantity : null);
  return {
    id: readString(row, ["id"], `line-${index}`),
    invoiceId: readString(row, ["invoice_id", "supplier_invoice_id"]),
    productId: readString(row, ["supplier_product_id", "product_id", "catalog_item_id"]),
    description,
    supplierReference: readString(row, ["supplier_reference", "supplier_sku", "sku", "product_code", "reference"]),
    quantity,
    unit: readString(row, ["purchase_unit", "unit", "uom"], "unité"),
    unitPriceHt,
    totalHt,
    category: inferCategory(firstValue(row, ["classification", "category", "kind", "product_type"]), description),
    observedAt: readDate(row, ["observed_on", "issue_date", "invoice_date"]),
    createdAt: readDate(row, ["created_at"]),
    lineNumber: readNumber(row, ["line_number", "line_no"]) ?? index,
    mappingStatus: readString(row, ["mapping_status"]),
  };
}

function normalizeProduct(row: DbRow, index: number): SupplierProduct {
  const name = readString(row, ["name", "display_name", "invoice_label", "supplier_label", "label", "description"], "Produit sans libellé");
  return {
    id: readString(row, ["id"], `product-${index}`),
    workspaceId: readString(row, ["workspace_id"]),
    name,
    supplier: readString(row, ["supplier_name", "supplier", "auguste_suppliers", "vendor_name"], ""),
    supplierReference: readString(row, ["supplier_reference", "supplier_sku", "sku", "reference", "ean"], ""),
    category: inferCategory(firstValue(row, ["classification", "category", "kind", "product_type"]), name),
    unit: readString(row, ["purchase_unit", "unit", "uom"], "unité"),
    currentPriceHt: readNumber(row, ["current_price_ht", "latest_price_ht", "price_ht_per_base_unit", "unit_price_ht"]),
    previousPriceHt: readNumber(row, ["previous_price_ht", "prior_price_ht", "last_price_ht"]),
    updatedAt: readDate(row, ["price_updated_at", "last_seen_at", "updated_at", "created_at"]),
    conversionStatus: readString(row, ["conversion_status"]),
  };
}

function invoiceDate(invoice: SupplierInvoice) {
  return invoice.issueDate || invoice.importedAt;
}

function isCreditInvoice(invoice: SupplierInvoice | undefined) {
  return Boolean(invoice?.documentType.toLocaleLowerCase("fr-FR").includes("credit"));
}

function isCostEligibleInvoice(invoice: SupplierInvoice | undefined): invoice is SupplierInvoice {
  if (!invoice) return false;
  const status = normalizeSearch(invoice.status).replace(/\s/g, "_");
  return ["validated", "valid", "approved", "complete", "completed"].includes(status);
}

function safeTime(value: string) {
  const time = Date.parse(value);
  return Number.isNaN(time) ? 0 : time;
}

function formatDate(value: string) {
  return value ? dateFormat.format(new Date(value)) : "Date inconnue";
}

function formatUnitPrice(value: number | null, unit: string) {
  if (value === null) return "—";
  const formatted = value < 0.1
    ? new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 3, maximumFractionDigits: 4 }).format(value)
    : euro.format(value);
  return `${formatted} / ${unit || "unité"}`;
}

function statusLabel(status: string) {
  const normalized = normalizeSearch(status).replace(/\s/g, "_");
  if (["validated", "valid", "approved", "complete", "completed"].includes(normalized)) return "Validée";
  if (["needs_review", "review", "to_review", "pending_review"].includes(normalized)) return "À vérifier";
  if (["rejected", "error", "failed"].includes(normalized)) return "Erreur";
  if (["duplicate", "duplicated"].includes(normalized)) return "Doublon";
  if (["processing", "pending", "queued"].includes(normalized)) return "En cours";
  return "Analysée";
}

function statusClass(status: string) {
  const label = statusLabel(status);
  if (label === "Validée") return "validated";
  if (label === "À vérifier" || label === "En cours") return "review";
  if (label === "Erreur" || label === "Doublon") return "problem";
  return "parsed";
}

function variationClass(value: number | null) {
  if (value === null || Math.abs(value) < 0.5) return "stable";
  return value > 0 ? "up" : "down";
}

function variationText(value: number | null) {
  if (value === null) return "Nouveau";
  if (Math.abs(value) < 0.05) return "Stable";
  return `${value > 0 ? "+" : ""}${value.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;
}

function Sparkline({ values, tone = "neutral" }: { values: number[]; tone?: "up" | "down" | "neutral" }) {
  const safeValues = values.filter(Number.isFinite);
  if (safeValues.length < 2) return <span className="purchase-sparkline-empty">Pas assez d’historique</span>;
  const width = 112;
  const height = 38;
  const padding = 4;
  const minimum = Math.min(...safeValues);
  const maximum = Math.max(...safeValues);
  const range = maximum - minimum || 1;
  const points = safeValues.map((value, index) => {
    const x = padding + (index / (safeValues.length - 1)) * (width - padding * 2);
    const y = height - padding - ((value - minimum) / range) * (height - padding * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const lastPoint = points.split(" ").at(-1)?.split(",") ?? [width - padding, height / 2];

  return (
    <svg className={`purchase-sparkline ${tone}`} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Évolution sur ${safeValues.length} relevés`}>
      <path d={`M${padding} ${height - padding}H${width - padding}`} />
      <polyline points={points} />
      <circle cx={lastPoint[0]} cy={lastPoint[1]} r="2.6" />
    </svg>
  );
}

function Icon({ name }: { name: "cart" | "trend" | "invoice" | "alert" | "refresh" }) {
  if (name === "trend") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 17 5-5 4 3 7-8M16 7h4v4" /></svg>;
  if (name === "invoice") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h9l3 3v15H6V3Zm3 7h6m-6 4h6m-6 4h4" /></svg>;
  if (name === "alert") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 3 20h18L12 3Zm0 6v5m0 3v.1" /></svg>;
  if (name === "refresh") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5M6.1 8.5A7 7 0 0 1 18.7 7M5.3 17A7 7 0 0 0 17.9 15.5" /></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5h2l2 10h10l2-7H6m2 11a1 1 0 1 0 0 .1m9-.1a1 1 0 1 0 0 .1" /></svg>;
}

export default function PurchasesCostsPanel({ userId }: { userId: string }) {
  const [view, setView] = useState<PurchasesView>("overview");
  const [snapshot, setSnapshot] = useState<PurchasesSnapshot>({ invoices: [], lines: [], products: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [liveStatus, setLiveStatus] = useState<"connecting" | "live" | "manual">("connecting");
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<ProductCategory | "all">("all");
  const requestSequenceRef = useRef(0);
  const mountedRef = useRef(true);

  const loadPurchases = useCallback(async (background = false) => {
    const requestId = ++requestSequenceRef.current;
    if (background) setRefreshing(true);
    else setLoading(true);
    setError("");

    try {
      async function fetchAllRows(
        tableName: string,
        columns: string,
        orderColumn: string,
        filter?: { column: string; value: string },
      ): Promise<DbRow[]> {
        const pageSize = 1000;
        const rows: DbRow[] = [];
        for (let page = 0; ; page += 1) {
          let request = supabase.from(tableName).select(columns);
          if (filter) request = request.eq(filter.column, filter.value);
          const { data, error: pageError } = await request
            .order(orderColumn, { ascending: false })
            .range(page * pageSize, (page + 1) * pageSize - 1);
          if (pageError) throw pageError;
          const pageRows = (data ?? []) as unknown as DbRow[];
          rows.push(...pageRows);
          if (pageRows.length < pageSize) break;
        }
        return rows;
      }

      async function fetchSupplierRows(tableName: string, orderColumn: string) {
        try {
          return await fetchAllRows(tableName, "*,supplier:auguste_suppliers(id,name)", orderColumn, { column: "workspace_id", value: WORKSPACE_ID });
        } catch {
          return fetchAllRows(tableName, "*", orderColumn, { column: "workspace_id", value: WORKSPACE_ID });
        }
      }

      const [invoiceRows, productRows, joinedLineRows] = await Promise.all([
        fetchSupplierRows(TABLES.invoices, "invoice_date"),
        fetchSupplierRows(TABLES.products, "updated_at"),
        fetchAllRows(TABLES.lines, "*,invoice:auguste_supplier_invoices!inner(workspace_id)", "created_at", { column: "invoice.workspace_id", value: WORKSPACE_ID }),
      ]);
      const invoiceIds = new Set(invoiceRows.map((row) => readString(row, ["id"])).filter(Boolean));
      if (!mountedRef.current || requestId !== requestSequenceRef.current) return;
      setSnapshot({
        invoices: invoiceRows,
        lines: joinedLineRows.filter((row) => invoiceIds.has(readString(row, ["invoice_id", "supplier_invoice_id"]))),
        products: productRows,
      });
    } catch (loadError) {
      console.warn("Les achats fournisseurs n’ont pas pu être chargés.", loadError);
      if (!mountedRef.current || requestId !== requestSequenceRef.current) return;
      const message = loadError && typeof loadError === "object" && "message" in loadError
        ? String((loadError as { message?: unknown }).message ?? "")
        : "";
      setError(message || "Impossible de charger les achats pour le moment.");
    } finally {
      if (mountedRef.current && requestId === requestSequenceRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void loadPurchases();
    let refreshTimer: number | undefined;
    const scheduleRefresh = () => {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => void loadPurchases(true), 450);
    };
    const channel = supabase
      .channel(`auguste-purchases:${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: TABLES.invoices }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: TABLES.lines }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: TABLES.products }, scheduleRefresh)
      .subscribe((status) => {
        if (!mountedRef.current) return;
        if (status === "SUBSCRIBED") setLiveStatus("live");
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") setLiveStatus("manual");
      });

    return () => {
      mountedRef.current = false;
      window.clearTimeout(refreshTimer);
      void supabase.removeChannel(channel);
    };
  }, [loadPurchases, userId]);

  const invoices = useMemo(
    () => snapshot.invoices.map(normalizeInvoice).sort((left, right) => safeTime(invoiceDate(right)) - safeTime(invoiceDate(left))),
    [snapshot.invoices],
  );
  const lines = useMemo(() => snapshot.lines.map(normalizeLine), [snapshot.lines]);
  const products = useMemo(() => snapshot.products.map(normalizeProduct), [snapshot.products]);
  const invoiceById = useMemo(() => new Map(invoices.map((invoice) => [invoice.id, invoice])), [invoices]);
  const productById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);

  const lineCounts = useMemo(() => {
    const counts = new Map<string, number>();
    lines.forEach((line) => counts.set(line.invoiceId, (counts.get(line.invoiceId) ?? 0) + 1));
    return counts;
  }, [lines]);

  const productTrends = useMemo<ProductTrend[]>(() => {
    const historyByProduct = new Map<string, PricePoint[]>();
    lines.forEach((line) => {
      if (line.unitPriceHt === null) return;
      const invoice = invoiceById.get(line.invoiceId);
      if (!isCostEligibleInvoice(invoice) || isCreditInvoice(invoice)) return;
      if (!line.productId) return;
      const key = `id:${line.productId}|unit:${normalizeSearch(line.unit)}`;
      const date = invoiceDate(invoice) || line.observedAt;
      const sortKey = [date, invoice.importedAt, line.createdAt, invoice.invoiceNumber, String(line.lineNumber).padStart(8, "0"), line.id].join("|");
      historyByProduct.set(key, [...(historyByProduct.get(key) ?? []), { date, price: line.unitPriceHt, invoiceId: line.invoiceId, sortKey }]);
    });

    const knownProductIds = new Set(products.map((product) => product.id));
    const baseProducts: SupplierProduct[] = [...products];
    const derivedKeys = new Set<string>();
    lines.forEach((line) => {
      const key = line.productId ? `id:${line.productId}` : `line:${line.id}`;
      if ((line.productId && knownProductIds.has(line.productId)) || derivedKeys.has(key)) return;
      derivedKeys.add(key);
      const invoice = invoiceById.get(line.invoiceId);
      baseProducts.push({
        id: line.productId || key,
        workspaceId: invoice?.workspaceId ?? "",
        name: line.description,
        supplier: invoice?.supplier === "Fournisseur" ? "" : invoice?.supplier ?? "",
        supplierReference: line.supplierReference,
        category: productById.get(line.productId)?.category ?? line.category,
        unit: line.unit,
        currentPriceHt: isCostEligibleInvoice(invoice) && !isCreditInvoice(invoice) ? line.unitPriceHt : null,
        previousPriceHt: null,
        updatedAt: line.observedAt || (invoice ? invoiceDate(invoice) : ""),
        conversionStatus: line.mappingStatus,
      });
    });

    return baseProducts.map((product) => {
      const idKey = `id:${product.id}|unit:${normalizeSearch(product.unit)}`;
      const history = [...(historyByProduct.get(idKey) ?? [])]
        .sort((left, right) => left.sortKey.localeCompare(right.sortKey, "fr", { numeric: true }));
      const latestHistory = history.at(-1)?.price ?? null;
      const previousHistory = history.length > 1 ? history.at(-2)?.price ?? null : null;
      const currentPriceHt = latestHistory ?? product.currentPriceHt;
      const previousPriceHt = previousHistory ?? product.previousPriceHt;
      const variationPercent = currentPriceHt !== null && previousPriceHt !== null && previousPriceHt !== 0
        ? ((currentPriceHt - previousPriceHt) / previousPriceHt) * 100
        : null;
      return {
        ...product,
        history,
        currentPriceHt,
        previousPriceHt,
        variationPercent,
        updatedAt: history.at(-1)?.date || product.updatedAt,
      };
    }).sort((left, right) => {
      const variationDifference = (right.variationPercent ?? -Infinity) - (left.variationPercent ?? -Infinity);
      return variationDifference || left.name.localeCompare(right.name, "fr");
    });
  }, [invoiceById, lines, productById, products]);

  const invoiceAmountHt = useCallback((invoice: SupplierInvoice) => {
    if (invoice.totalHt !== null) return isCreditInvoice(invoice) ? -Math.abs(invoice.totalHt) : invoice.totalHt;
    const amount = lines.filter((line) => line.invoiceId === invoice.id).reduce((sum, line) => sum + (line.totalHt ?? 0), 0);
    return isCreditInvoice(invoice) ? -Math.abs(amount) : amount;
  }, [lines]);

  const signedLineTotal = useCallback((line: SupplierInvoiceLine) => {
    const invoice = invoiceById.get(line.invoiceId);
    if (!isCostEligibleInvoice(invoice)) return 0;
    const amount = line.totalHt ?? 0;
    return isCreditInvoice(invoice) ? -Math.abs(amount) : amount;
  }, [invoiceById]);

  const now = Date.now();
  const periodMs = 30 * 24 * 60 * 60 * 1000;
  const spendLast30Days = useMemo(() => lines.reduce((sum, line) => {
    const invoice = invoiceById.get(line.invoiceId);
    if (!isCostEligibleInvoice(invoice)) return sum;
    const age = now - safeTime(invoiceDate(invoice));
    const category = productById.get(line.productId)?.category ?? line.category;
    return category === "food" && age >= 0 && age <= periodMs ? sum + signedLineTotal(line) : sum;
  }, 0), [invoiceById, lines, now, periodMs, productById, signedLineTotal]);
  const spendPrevious30Days = useMemo(() => lines.reduce((sum, line) => {
    const invoice = invoiceById.get(line.invoiceId);
    if (!isCostEligibleInvoice(invoice)) return sum;
    const age = now - safeTime(invoiceDate(invoice));
    const category = productById.get(line.productId)?.category ?? line.category;
    return category === "food" && age > periodMs && age <= periodMs * 2 ? sum + signedLineTotal(line) : sum;
  }, 0), [invoiceById, lines, now, periodMs, productById, signedLineTotal]);
  const spendVariation = spendPrevious30Days > 0 ? ((spendLast30Days - spendPrevious30Days) / spendPrevious30Days) * 100 : null;
  const risingProducts = productTrends.filter((product) => (product.variationPercent ?? 0) >= 5);
  const biggestIncrease = risingProducts[0] ?? null;

  const categoryTotals = useMemo(() => {
    const totals: Record<ProductCategory, number> = { food: 0, beverage: 0, non_food: 0 };
    lines.forEach((line) => {
      const category = productById.get(line.productId)?.category ?? line.category;
      totals[category] += signedLineTotal(line);
    });
    return totals;
  }, [lines, productById, signedLineTotal]);
  const categoryGrandTotal = Object.values(categoryTotals).reduce((sum, value) => sum + value, 0);

  const topMaterialProducts = useMemo(() => {
    const totals = new Map<string, number>();
    lines.forEach((line) => {
      if (!line.productId || (productById.get(line.productId)?.category ?? line.category) !== "food") return;
      totals.set(line.productId, (totals.get(line.productId) ?? 0) + signedLineTotal(line));
    });
    return [...totals.entries()]
      .filter(([, total]) => total > 0)
      .map(([productId, total]) => ({
        productId,
        total,
        name: productById.get(productId)?.name ?? lines.find((line) => line.productId === productId)?.description ?? "Produit",
      }))
      .sort((left, right) => right.total - left.total)
      .slice(0, 3);
  }, [lines, productById, signedLineTotal]);

  const unresolvedMappingCount = useMemo(() => {
    const confirmedStatuses = new Set(["confirmed", "validated", "mapped", "complete", "converted", "ready", "not_required", "not_applicable", "excluded"]);
    const unresolved = new Set<string>();
    products.forEach((product) => {
      const status = normalizeSearch(product.conversionStatus).replace(/\s/g, "_");
      if (status && !confirmedStatuses.has(status)) unresolved.add(`product:${product.id}`);
    });
    lines.forEach((line) => {
      const status = normalizeSearch(line.mappingStatus).replace(/\s/g, "_");
      if (status && !confirmedStatuses.has(status)) unresolved.add(line.productId ? `product:${line.productId}` : `line:${line.id}`);
    });
    return unresolved.size;
  }, [lines, products]);

  const monthlySpend = useMemo(() => {
    const months = new Map<string, { date: Date; total: number }>();
    invoices.forEach((invoice) => {
      if (!isCostEligibleInvoice(invoice)) return;
      const value = invoiceDate(invoice);
      if (!value) return;
      const date = new Date(value);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const current = months.get(key) ?? { date: new Date(date.getFullYear(), date.getMonth(), 1), total: 0 };
      current.total += invoiceAmountHt(invoice);
      months.set(key, current);
    });
    return [...months.values()].sort((left, right) => left.date.getTime() - right.date.getTime()).slice(-6);
  }, [invoiceAmountHt, invoices]);

  const filteredProducts = useMemo(() => {
    const normalizedQuery = normalizeSearch(query);
    return productTrends.filter((product) => {
      const matchesCategory = categoryFilter === "all" || product.category === categoryFilter;
      const haystack = normalizeSearch(`${product.name} ${product.supplier} ${product.supplierReference}`);
      return matchesCategory && (!normalizedQuery || haystack.includes(normalizedQuery));
    });
  }, [categoryFilter, productTrends, query]);

  const hasData = invoices.length > 0 || lines.length > 0 || products.length > 0;

  if (loading) {
    return <section className="purchases-state" aria-live="polite"><span className="purchases-state-mark"><Icon name="cart" /></span><strong>Chargement des achats…</strong><p>Lecture des factures et des prix fournisseurs.</p></section>;
  }

  if (error && !hasData) {
    return <section className="purchases-state error" role="alert"><span className="purchases-state-mark"><Icon name="alert" /></span><strong>Les achats ne sont pas encore accessibles</strong><p>{error}</p><button type="button" onClick={() => void loadPurchases()}>Réessayer</button></section>;
  }

  if (!hasData) {
    return <section className="purchases-state empty"><span className="purchases-state-mark"><Icon name="invoice" /></span><strong>Aucune facture intégrée pour le moment</strong><p>Les factures reçues seront affichées ici dès que l’import automatique sera branché.</p><button type="button" onClick={() => void loadPurchases()}>Actualiser</button></section>;
  }

  return (
    <section className="purchases-panel">
      <div className="purchases-hero">
        <div>
          <p className="eyebrow">Surveillance fournisseurs</p>
          <h2>Achats & coûts</h2>
          <p>Suivez les factures, les hausses de prix et les postes qui fragilisent la marge.</p>
        </div>
        <div className="purchases-live-status">
          <span className={liveStatus === "live" ? "" : "offline"}><i />{liveStatus === "live" ? "Actualisé en direct" : liveStatus === "connecting" ? "Connexion au direct…" : "Actualisation manuelle"}</span>
          <button type="button" onClick={() => void loadPurchases(true)} disabled={refreshing} aria-label="Actualiser les achats"><Icon name="refresh" />{refreshing ? "Actualisation…" : "Actualiser"}</button>
        </div>
      </div>

      {error && <div className="purchases-inline-warning" role="status"><Icon name="alert" /><span>La dernière actualisation a échoué. Les données déjà chargées restent affichées.</span></div>}

      <nav className="purchases-tabs" role="tablist" aria-label="Vues des achats">
        <button type="button" role="tab" aria-selected={view === "overview"} className={view === "overview" ? "active" : ""} onClick={() => setView("overview")}><span>01</span><strong>Vue d’ensemble</strong><small>Alertes & dépenses</small></button>
        <button type="button" role="tab" aria-selected={view === "products"} className={view === "products" ? "active" : ""} onClick={() => setView("products")}><span>02</span><strong>Produits</strong><small>{productTrends.length} suivis</small></button>
        <button type="button" role="tab" aria-selected={view === "invoices"} className={view === "invoices" ? "active" : ""} onClick={() => setView("invoices")}><span>03</span><strong>Factures</strong><small>{invoices.length} reçues</small></button>
      </nav>

      {view === "overview" && <>
        <div className="purchases-kpis">
          <article>
            <span className="purchase-kpi-icon"><Icon name="cart" /></span>
            <small>Achats cuisine HT · 30 jours</small>
            <strong>{compactEuro.format(spendLast30Days)}</strong>
            <p className={variationClass(spendVariation)}>{spendPrevious30Days > 0 ? `${variationText(spendVariation)} vs période précédente` : `${invoices.length} facture${invoices.length > 1 ? "s" : ""} intégrée${invoices.length > 1 ? "s" : ""}`}</p>
          </article>
          <article>
            <span className="purchase-kpi-icon"><Icon name="trend" /></span>
            <small>Produits en hausse</small>
            <strong>{risingProducts.length}</strong>
            <p>{risingProducts.length ? "Hausse d’au moins 5 %" : "Aucune hausse forte détectée"}</p>
          </article>
          <article>
            <span className="purchase-kpi-icon"><Icon name="alert" /></span>
            <small>Plus forte hausse</small>
            <strong>{biggestIncrease?.variationPercent !== null && biggestIncrease ? variationText(biggestIncrease.variationPercent) : "—"}</strong>
            <p>{biggestIncrease?.name ?? (productTrends.some((product) => product.variationPercent !== null) ? "Aucune hausse détectée" : "Historique insuffisant")}</p>
          </article>
          <article>
            <span className="purchase-kpi-icon"><Icon name="invoice" /></span>
            <small>Dernière facture</small>
            <strong>{invoices[0]?.totalHt !== null && invoices[0] ? compactEuro.format(invoiceAmountHt(invoices[0])) : "—"}</strong>
            <p>{invoices[0] ? `${invoices[0].supplier} · ${formatDate(invoiceDate(invoices[0]))}` : "Aucune facture"}</p>
          </article>
        </div>

        {unresolvedMappingCount > 0 && <div className="purchase-mapping-note">
          <span>{unresolvedMappingCount}</span>
          <div><strong>Produit{unresolvedMappingCount > 1 ? "s" : ""} sans correspondance recette</strong><small>Dès qu’un produit de facture correspond à un ingrédient, son dernier prix alimente automatiquement la recette. Ces produits restent provisoirement couverts par l’estimation existante.</small></div>
        </div>}

        <div className="purchases-overview-grid">
          <section className="purchase-card price-alerts">
            <div className="purchase-section-heading">
              <div><p className="eyebrow">À surveiller</p><h3>Variations de prix</h3></div>
              <button type="button" onClick={() => setView("products")}>Tous les produits →</button>
            </div>
            {productTrends.filter((product) => product.variationPercent !== null).slice(0, 5).map((product) => <article className="price-alert-row" key={product.id}>
              <span className={`purchase-category-dot ${product.category}`} aria-hidden="true" />
              <div><strong>{product.name}</strong><small>{product.supplier || product.supplierReference || CATEGORY_LABELS[product.category]}</small></div>
              <Sparkline values={product.history.map((point) => point.price)} tone={variationClass(product.variationPercent) === "up" ? "up" : variationClass(product.variationPercent) === "down" ? "down" : "neutral"} />
              <div className="price-alert-value"><strong>{formatUnitPrice(product.currentPriceHt, product.unit)}</strong><span className={variationClass(product.variationPercent)}>{variationText(product.variationPercent)}</span></div>
            </article>)}
            {!productTrends.some((product) => product.variationPercent !== null) && <div className="purchase-card-empty"><strong>Pas encore de comparaison</strong><span>Deux prix datés sont nécessaires pour mesurer une variation.</span></div>}
          </section>

          <section className="purchase-card spend-breakdown">
            <div className="purchase-section-heading"><div><p className="eyebrow">Répartition</p><h3>Nature des achats</h3></div><span>{compactEuro.format(categoryGrandTotal)} HT analysés</span></div>
            <div className="spend-trend">
              <div><strong>Évolution mensuelle</strong><small>{monthlySpend.length} mois disponibles</small></div>
              <Sparkline values={monthlySpend.map((month) => month.total)} tone="neutral" />
            </div>
            <div className="category-bars">
              {(Object.keys(CATEGORY_LABELS) as ProductCategory[]).map((category) => {
                const share = categoryGrandTotal > 0 ? (categoryTotals[category] / categoryGrandTotal) * 100 : 0;
                return <div className="category-bar-row" key={category}>
                  <div><span className={`purchase-category-dot ${category}`} /><strong>{CATEGORY_LABELS[category]}</strong><b>{share.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} %</b></div>
                  <span><i className={category} style={{ width: `${Math.max(share, categoryTotals[category] > 0 ? 2 : 0)}%` }} /></span>
                  <small>{euro.format(categoryTotals[category])}</small>
                </div>;
              })}
            </div>
            {topMaterialProducts.length > 0 && <div className="purchase-concentration">
              <div><strong>Concentration du coût matière</strong><small>Les 3 produits qui pèsent le plus dans les achats cuisine</small></div>
              {topMaterialProducts.map((product, index) => {
                const share = categoryTotals.food > 0 ? (product.total / categoryTotals.food) * 100 : 0;
                return <div className="concentration-row" key={product.productId}>
                  <span>{index + 1}</span><strong>{product.name}</strong><i><b style={{ width: `${Math.max(2, share)}%` }} /></i><small>{euro.format(product.total)} · {share.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %</small>
                </div>;
              })}
            </div>}
            {monthlySpend.length > 0 && <div className="month-labels">{monthlySpend.map((month) => <span key={month.date.toISOString()}>{monthFormat.format(month.date)}<strong>{compactEuro.format(month.total)}</strong></span>)}</div>}
          </section>
        </div>

        <section className="purchase-card recent-invoices">
          <div className="purchase-section-heading"><div><p className="eyebrow">Derniers imports</p><h3>Factures récentes</h3></div><button type="button" onClick={() => setView("invoices")}>Voir l’historique →</button></div>
          <div className="invoice-list compact">
            {invoices.slice(0, 5).map((invoice) => <article className="invoice-row" key={invoice.id}>
              <span className="invoice-icon"><Icon name="invoice" /></span>
              <div className="invoice-main"><strong>{invoice.supplier}</strong><small>{invoice.invoiceNumber} · {lineCounts.get(invoice.id) ?? 0} ligne{(lineCounts.get(invoice.id) ?? 0) > 1 ? "s" : ""}</small></div>
              <time dateTime={invoiceDate(invoice)}>{formatDate(invoiceDate(invoice))}</time>
              <span className={`invoice-status ${statusClass(invoice.status)}`}>{statusLabel(invoice.status)}</span>
              <strong className="invoice-total">{euro.format(invoiceAmountHt(invoice))}<small> HT</small></strong>
            </article>)}
          </div>
        </section>
      </>}

      {view === "products" && <section className="purchase-card products-view">
        <div className="purchase-section-heading products-heading"><div><p className="eyebrow">Catalogue fournisseur</p><h3>Prix des produits</h3></div><span>{filteredProducts.length} résultat{filteredProducts.length > 1 ? "s" : ""}</span></div>
        <div className="products-toolbar">
          <label><span aria-hidden="true">⌕</span><input aria-label="Rechercher un produit ou une référence" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher un produit, une référence…" />{query && <button type="button" onClick={() => setQuery("")} aria-label="Effacer la recherche">×</button>}</label>
          <div className="category-filters" aria-label="Filtrer par catégorie">
            <button type="button" aria-pressed={categoryFilter === "all"} className={categoryFilter === "all" ? "active" : ""} onClick={() => setCategoryFilter("all")}>Tous</button>
            {(Object.keys(CATEGORY_LABELS) as ProductCategory[]).map((category) => <button type="button" aria-pressed={categoryFilter === category} className={categoryFilter === category ? `active ${category}` : ""} onClick={() => setCategoryFilter(category)} key={category}>{CATEGORY_LABELS[category]}</button>)}
          </div>
        </div>
        <div className="product-table" aria-label="Historique des prix fournisseurs">
          <div className="product-row product-head"><span>Produit</span><span>Catégorie</span><span>Prix actuel HT</span><span>Évolution</span><span>Tendance</span><span>Dernier relevé</span></div>
          {filteredProducts.map((product) => <article className="product-row" key={`${product.id}:${product.unit}`}>
            <div className="product-identity"><span className={`purchase-category-dot ${product.category}`} /><div><strong>{product.name}</strong><small>{[product.supplier, product.supplierReference].filter(Boolean).join(" · ") || "Référence fournisseur à compléter"}</small></div></div>
            <span className={`category-pill ${product.category}`}>{CATEGORY_LABELS[product.category]}</span>
            <strong className="product-price">{formatUnitPrice(product.currentPriceHt, product.unit)}</strong>
            <span className={`variation-badge ${variationClass(product.variationPercent)}`}>{variationText(product.variationPercent)}</span>
            <Sparkline values={product.history.map((point) => point.price)} tone={variationClass(product.variationPercent) === "up" ? "up" : variationClass(product.variationPercent) === "down" ? "down" : "neutral"} />
            <time dateTime={product.updatedAt}>{formatDate(product.updatedAt)}</time>
          </article>)}
          {filteredProducts.length === 0 && <div className="purchase-card-empty"><strong>Aucun produit ne correspond</strong><span>Modifiez la recherche ou le filtre sélectionné.</span></div>}
        </div>
      </section>}

      {view === "invoices" && <section className="purchase-card invoices-view">
        <div className="purchase-section-heading"><div><p className="eyebrow">Documents fournisseurs</p><h3>Historique des factures</h3></div><span>{invoices.length} document{invoices.length > 1 ? "s" : ""}</span></div>
        <div className="invoice-summary-strip">
          <div><span>Total HT importé</span><strong>{euro.format(invoices.reduce((sum, invoice) => sum + invoiceAmountHt(invoice), 0))}</strong></div>
          <div><span>À vérifier</span><strong>{invoices.filter((invoice) => statusLabel(invoice.status) === "À vérifier").length}</strong></div>
          <div><span>Lignes analysées</span><strong>{lines.length}</strong></div>
        </div>
        <div className="invoice-list">
          {invoices.map((invoice) => <article className="invoice-row" key={invoice.id}>
            <span className="invoice-icon"><Icon name="invoice" /></span>
            <div className="invoice-main"><strong>{invoice.supplier}</strong><small>{invoice.invoiceNumber} · {lineCounts.get(invoice.id) ?? 0} ligne{(lineCounts.get(invoice.id) ?? 0) > 1 ? "s" : ""}</small></div>
            <time dateTime={invoiceDate(invoice)}>{formatDate(invoiceDate(invoice))}</time>
            <span className={`invoice-status ${statusClass(invoice.status)}`}>{statusLabel(invoice.status)}</span>
            <strong className="invoice-total">{euro.format(invoiceAmountHt(invoice))}<small> HT</small></strong>
          </article>)}
        </div>
      </section>}
    </section>
  );
}
