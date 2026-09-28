import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "./shared-state";
import "./daily-z-panel.css";

type ZSalesLine = {
  category: string;
  product: string;
  quantity: number;
  total_ttc: number;
  total_ht: number;
};

type ZReport = {
  id: string;
  report_date: string;
  source_subject: string;
  revenue_ttc: number;
  revenue_ht: number;
  covers: number;
  avg_basket_ttc: number | null;
  sales_lines: ZSalesLine[];
};

type InvoiceRow = {
  invoice_date: string;
  subtotal_ht: number | null;
  document_type: string;
  status: string;
};

type MonthTotal = {
  key: string;
  label: string;
  sales: number;
  purchases: number;
};

const WORKSPACE_ID = "a617e000-0000-4000-8000-000000000001";
const euro = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const monthNames = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" });
const dayNames = new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short" });

function monthKey(value: string) {
  return value.slice(0, 7);
}

function monthLabel(key: string) {
  const [year, month] = key.split("-").map(Number);
  return monthNames.format(new Date(year, month - 1, 15));
}

function dateLabel(value: string) {
  return dayNames.format(new Date(`${value}T12:00:00`));
}

function isIncludedInvoice(invoice: InvoiceRow) {
  return ["validated", "valid", "approved", "complete", "completed"].includes(invoice.status.toLowerCase());
}

function invoiceAmount(invoice: InvoiceRow) {
  const amount = Math.abs(Number(invoice.subtotal_ht ?? 0));
  return invoice.document_type.toLowerCase().includes("credit") ? -amount : amount;
}

export default function DailyZPanel({ embedded = false }: { embedded?: boolean }) {
  const [reports, setReports] = useState<ZReport[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setError("");
    const [zResult, invoiceResult] = await Promise.all([
      supabase.from("auguste_daily_z_reports")
        .select("id,report_date,source_subject,revenue_ttc,revenue_ht,covers,avg_basket_ttc,sales_lines")
        .eq("workspace_id", WORKSPACE_ID)
        .order("report_date", { ascending: false }),
      supabase.from("auguste_supplier_invoices")
        .select("invoice_date,subtotal_ht,document_type,status")
        .eq("workspace_id", WORKSPACE_ID)
        .order("invoice_date", { ascending: false }),
    ]);
    if (zResult.error || invoiceResult.error) {
      setError("Les données de ventes ou d’achats n’ont pas pu être chargées.");
      setLoading(false);
      return;
    }
    const nextReports = (zResult.data ?? []) as ZReport[];
    setReports(nextReports);
    setInvoices((invoiceResult.data ?? []) as InvoiceRow[]);
    setSelectedMonth((current) => current || (nextReports[0] ? monthKey(nextReports[0].report_date) : ""));
    setSelectedDate((current) => current || nextReports[0]?.report_date || "");
    setLoading(false);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    const channel = supabase.channel("auguste-sales-purchases-live")
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "auguste_daily_z_reports",
        filter: `workspace_id=eq.${WORKSPACE_ID}`,
      }, () => { void refresh(); })
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "auguste_supplier_invoices",
        filter: `workspace_id=eq.${WORKSPACE_ID}`,
      }, () => { void refresh(); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [refresh]);

  const months = useMemo<MonthTotal[]>(() => {
    const byMonth = new Map<string, MonthTotal>();
    const get = (key: string) => {
      let item = byMonth.get(key);
      if (!item) {
        item = { key, label: monthLabel(key), sales: 0, purchases: 0 };
        byMonth.set(key, item);
      }
      return item;
    };
    reports.forEach((report) => { get(monthKey(report.report_date)).sales += Number(report.revenue_ht || 0); });
    invoices.filter(isIncludedInvoice).forEach((invoice) => {
      if (invoice.invoice_date) get(monthKey(invoice.invoice_date)).purchases += invoiceAmount(invoice);
    });
    return [...byMonth.values()].sort((a, b) => b.key.localeCompare(a.key));
  }, [reports, invoices]);

  const currentMonth = months.find((month) => month.key === selectedMonth);
  const monthReports = reports.filter((report) => monthKey(report.report_date) === selectedMonth);
  const activeReport = monthReports.find((report) => report.report_date === selectedDate) ?? monthReports[0];
  const monthCoverage = monthReports.length
    ? `du ${dateLabel(monthReports.reduce((earliest, report) => report.report_date < earliest ? report.report_date : earliest, monthReports[0].report_date))} au ${dateLabel(monthReports.reduce((latest, report) => report.report_date > latest ? report.report_date : latest, monthReports[0].report_date))}`
    : "aucune journée disponible";
  const difference = (currentMonth?.sales ?? 0) - (currentMonth?.purchases ?? 0);
  const chartMonths = [...months].reverse().slice(-8);
  const chartMax = Math.max(1, ...chartMonths.flatMap((month) => [month.sales, month.purchases]));

  return (
    <section className="daily-z" aria-labelledby="daily-z-title">
      <header className="daily-z-heading">
        <div><p className="eyebrow">Résultats du restaurant</p><h2 id="daily-z-title">{embedded ? "Résumé des Z" : "Ventes & achats"}</h2><p>Les Z et exports produits de L’Addition sont rapprochés des factures fournisseurs validées.</p></div>
        <button className="daily-z-refresh" type="button" onClick={() => { setLoading(true); void refresh(); }}>Actualiser</button>
      </header>

      {loading ? <div className="daily-z-empty">Chargement des ventes et des achats…</div> : error ? <div className="daily-z-error" role="alert">{error}<button type="button" onClick={() => { setLoading(true); void refresh(); }}>Réessayer</button></div> : reports.length === 0 ? (
        <div className="daily-z-empty"><strong>Aucun Z importé</strong><span>Les rapports reçus par e-mail apparaîtront ici automatiquement.</span></div>
      ) : <>
        <div className="daily-z-controls">
          <label htmlFor="daily-z-month">Période</label>
          <select id="daily-z-month" value={selectedMonth} onChange={(event) => { setSelectedMonth(event.target.value); const report = reports.find((item) => monthKey(item.report_date) === event.target.value); setSelectedDate(report?.report_date ?? ""); }}>
            {months.map((month) => <option key={month.key} value={month.key}>{month.label}</option>)}
          </select>
          <span>{monthReports.length} journée{monthReports.length > 1 ? "s" : ""} renseignée{monthReports.length > 1 ? "s" : ""}</span>
        </div>

        <div className="daily-z-kpis">
          <article><span>Ventes HT</span><strong>{euro.format(currentMonth?.sales ?? 0)}</strong><small>{monthReports.length} journée{monthReports.length > 1 ? "s" : ""} · {monthCoverage}</small></article>
          <article><span>Achats fournisseurs HT</span><strong>{euro.format(currentMonth?.purchases ?? 0)}</strong><small>Factures validées du mois</small></article>
          <article className={(difference >= 0 ? "positive" : "negative")}><span>Ventes − achats</span><strong>{euro.format(difference)}</strong><small>Écart brut · ventes sur journées renseignées</small></article>
        </div>

        <section className="daily-z-card">
          <div className="daily-z-card-title"><div><p className="eyebrow">Comparatif mensuel</p><h3>Ventes HT et achats fournisseurs HT</h3></div><div className="daily-z-legend"><span className="sales-legend">Ventes</span><span className="purchases-legend">Achats</span></div></div>
          <div className="daily-z-chart" role="img" aria-label="Comparaison mensuelle des ventes HT et achats fournisseurs HT">
            {chartMonths.map((month) => <div className="daily-z-chart-column" key={month.key} aria-label={`${month.label} : ventes ${euro.format(month.sales)}, achats ${euro.format(month.purchases)}`}>
              <div className="daily-z-bars"><i className="sales-bar" style={{ height: `${Math.max(2, (month.sales / chartMax) * 100)}%` }} /><i className="purchases-bar" style={{ height: `${Math.max(2, (month.purchases / chartMax) * 100)}%` }} /></div>
              <span>{month.label}</span>
            </div>)}
          </div>
          <p className="daily-z-note">Les ventes ne couvrent que les journées affichées ({monthCoverage}) ; les jours absents ne sont pas comptés comme zéro. L’écart ventes − achats reste un repère de suivi : il ne déduit ni les stocks restants, ni les salaires, le loyer ou les autres charges.</p>
        </section>

        <div className="daily-z-detail-grid">
          <section className="daily-z-card">
            <div className="daily-z-card-title"><div><p className="eyebrow">Rapports reçus</p><h3>Ventes par jour</h3></div></div>
            <div className="daily-z-days">
              {monthReports.map((report) => <button type="button" key={report.id} aria-pressed={activeReport?.id === report.id} className={activeReport?.id === report.id ? "active" : ""} onClick={() => setSelectedDate(report.report_date)}>
                <span><strong>{dateLabel(report.report_date)}</strong><small>{Number(report.covers || 0) > 0 ? `${Number(report.covers).toLocaleString("fr-FR")} couverts` : "Couverts indisponibles"}</small></span><b>{euro.format(Number(report.revenue_ht || 0))} HT</b>
              </button>)}
            </div>
          </section>

          <section className="daily-z-card">
            <div className="daily-z-card-title"><div><p className="eyebrow">{activeReport ? dateLabel(activeReport.report_date) : "Détail"}</p><h3>Produits vendus</h3>{activeReport?.source_subject?.toLocaleLowerCase("fr-FR").includes("export produits") && <small className="daily-z-source-note">Export L’Addition · CA HT recalculé selon la TVA produit · remises, offerts et couverts absents</small>}</div><strong>{activeReport ? euro.format(Number(activeReport.revenue_ttc || 0)) + " TTC" : "—"}</strong></div>
            {activeReport?.sales_lines?.some((line) => line.product && line.product !== "Produit" && Number.isFinite(Number(line.quantity)) && Number(line.quantity) > 0) ? <div className="daily-z-products">
              {[...activeReport.sales_lines]
                .filter((line) => line.product && line.product !== "Produit" && Number.isFinite(Number(line.quantity)) && Number(line.quantity) > 0)
                .sort((a, b) => Number(b.total_ht) - Number(a.total_ht))
                .map((line, index) => <div key={`${line.product}-${index}`}><span><strong>{line.product}</strong><small>{line.category} · {Number(line.quantity).toLocaleString("fr-FR")} vendu{Number(line.quantity) > 1 ? "s" : ""}</small></span><b>{euro.format(Number(line.total_ht || 0))} HT</b></div>)}
            </div> : <div className="daily-z-empty">Aucun détail disponible pour cette journée.</div>}
          </section>
        </div>
      </>}
    </section>
  );
}
