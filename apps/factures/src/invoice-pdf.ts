import { jsPDF } from "jspdf";
import robotoVfs from "pdfmake/build/vfs_fonts.js";

import type { PrintableInvoice } from "./types";
import { fileSlug, frenchDate, lineTotal } from "./utils";

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN_X = 20;
const INK: [number, number, number] = [7, 17, 31];
const BLUE: [number, number, number] = [31, 91, 255];
const MUTED: [number, number, number] = [102, 113, 128];
const LINE: [number, number, number] = [222, 227, 234];
const PAPER: [number, number, number] = [255, 255, 255];
const SOFT: [number, number, number] = [244, 247, 251];

function clean(value: unknown) {
  return String(value ?? "")
    .replaceAll("\u00a0", " ")
    .replaceAll("\u2011", "-")
    .replaceAll("\u202f", " ");
}

function registerFonts(doc: jsPDF) {
  const fonts: Array<[string, "normal" | "bold" | "italic" | "bolditalic"]> = [
    ["Roboto-Regular.ttf", "normal"],
    ["Roboto-Medium.ttf", "bold"],
    ["Roboto-Italic.ttf", "italic"],
    ["Roboto-MediumItalic.ttf", "bolditalic"],
  ];
  for (const [filename, style] of fonts) {
    doc.addFileToVFS(filename, robotoVfs[filename]);
    doc.addFont(filename, "Roboto", style);
  }
}

function setText(doc: jsPDF, color: [number, number, number]) {
  doc.setTextColor(color[0], color[1], color[2]);
}

function money(value: number) {
  const formatted = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .format(value || 0)
    .replace(/[\u00a0\u202f]/g, " ");
  return `${formatted} €`;
}

function clientName(invoice: PrintableInvoice) {
  const client = invoice.client;
  return client.type === "professional"
    ? client.company_name || client.contact_name
    : client.contact_name || client.company_name;
}

function drawChrome(doc: jsPDF, invoice: PrintableInvoice, page: number) {
  doc.setFillColor(...PAPER);
  doc.rect(0, 0, PAGE_W, PAGE_H, "F");
  doc.setFillColor(...BLUE);
  doc.rect(0, 0, 6, PAGE_H, "F");

  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.2);
  doc.line(MARGIN_X, 284, PAGE_W - MARGIN_X, 284);
  doc.setFont("Roboto", "bold");
  doc.setFontSize(6.5);
  setText(doc, INK);
  doc.text(clean(invoice.issuer.trade_name || invoice.issuer.legal_name).toUpperCase(), MARGIN_X, 289);
  doc.setFont("Roboto", "normal");
  setText(doc, MUTED);
  doc.text(`${invoice.documentCode || "BROUILLON"}  ·  ${String(page).padStart(2, "0")}`, PAGE_W - MARGIN_X, 289, { align: "right" });
}

function drawHeader(doc: jsPDF, invoice: PrintableInvoice, continuation = false) {
  const title = invoice.documentType === "credit" ? "AVOIR" : "FACTURE";
  doc.setFont("Roboto", "bold");
  doc.setFontSize(8);
  setText(doc, BLUE);
  doc.text(clean(invoice.issuer.trade_name || invoice.issuer.legal_name).toUpperCase(), MARGIN_X, 22);

  doc.setFontSize(continuation ? 17 : 28);
  setText(doc, INK);
  doc.text(continuation ? `${title} · SUITE` : title, PAGE_W - MARGIN_X, continuation ? 24 : 27, { align: "right" });
  doc.setFontSize(9);
  setText(doc, MUTED);
  doc.text(invoice.documentCode || "BROUILLON", PAGE_W - MARGIN_X, continuation ? 31 : 36, { align: "right" });

  if (continuation) {
    doc.setDrawColor(...LINE);
    doc.line(MARGIN_X, 39, PAGE_W - MARGIN_X, 39);
    return 48;
  }

  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.3);
  doc.line(MARGIN_X, 45, PAGE_W - MARGIN_X, 45);

  const leftX = MARGIN_X;
  const rightX = 111;
  const labelY = 57;
  const bodyY = 65;
  doc.setFont("Roboto", "bold");
  doc.setFontSize(6.5);
  setText(doc, BLUE);
  doc.text("ÉMETTEUR", leftX, labelY);
  doc.text("DESTINATAIRE", rightX, labelY);

  doc.setFontSize(10.5);
  setText(doc, INK);
  doc.text(`${clean(invoice.issuer.legal_name)} · EI`, leftX, bodyY);
  doc.text(clean(clientName(invoice) || "Client à sélectionner"), rightX, bodyY);

  doc.setFont("Roboto", "normal");
  doc.setFontSize(7.5);
  setText(doc, MUTED);
  const issuerLines = [
    invoice.issuer.address,
    `${invoice.issuer.postcode} ${invoice.issuer.city}`,
    invoice.senderEmail,
    invoice.issuer.phone,
    `SIREN ${invoice.issuer.siren} · SIRET ${invoice.issuer.siret}`,
  ].filter(Boolean).map(clean);
  doc.text(issuerLines, leftX, bodyY + 7, { lineHeightFactor: 1.35 });

  const clientLines = [
    invoice.client.type === "professional" && invoice.client.company_name && invoice.client.contact_name
      ? invoice.client.contact_name
      : "",
    invoice.client.billing_address || invoice.client.address,
    `${invoice.client.postcode} ${invoice.client.city}`,
    invoice.client.email,
    invoice.client.siren ? `SIREN ${invoice.client.siren}` : "",
  ].filter(Boolean).map(clean);
  doc.text(clientLines, rightX, bodyY + 7, { lineHeightFactor: 1.35 });

  doc.setFillColor(...SOFT);
  doc.roundedRect(MARGIN_X, 101, PAGE_W - MARGIN_X * 2, 21, 2, 2, "F");
  const metas = [
    ["ÉMISSION", frenchDate(invoice.issueDate)],
    ["PRESTATION", frenchDate(invoice.serviceDate)],
    ["ÉCHÉANCE", frenchDate(invoice.dueDate)],
  ];
  if (invoice.purchaseOrder) metas.push(["RÉFÉRENCE", invoice.purchaseOrder]);
  const metaWidth = (PAGE_W - MARGIN_X * 2) / metas.length;
  metas.forEach(([label, value], index) => {
    const x = MARGIN_X + 7 + metaWidth * index;
    doc.setFont("Roboto", "bold");
    doc.setFontSize(5.8);
    setText(doc, MUTED);
    doc.text(label, x, 109);
    doc.setFontSize(7.6);
    setText(doc, INK);
    doc.text(clean(value), x, 116);
  });
  return 133;
}

function drawTableHeader(doc: jsPDF, y: number) {
  doc.setFillColor(...INK);
  doc.roundedRect(MARGIN_X, y, PAGE_W - MARGIN_X * 2, 11, 1.6, 1.6, "F");
  doc.setFont("Roboto", "bold");
  doc.setFontSize(6.2);
  doc.setTextColor(255, 255, 255);
  doc.text("DÉSIGNATION", 26, y + 7);
  doc.text("QTÉ", 139, y + 7, { align: "right" });
  doc.text("PRIX UNIT.", 164, y + 7, { align: "right" });
  doc.text("MONTANT", 190, y + 7, { align: "right" });
  return y + 11;
}

function drawLine(doc: jsPDF, line: PrintableInvoice["lines"][number], y: number) {
  doc.setFont("Roboto", "bold");
  doc.setFontSize(8.4);
  setText(doc, INK);
  const titleLines = doc.splitTextToSize(clean(line.description || "Prestation"), 98).slice(0, 3);
  doc.text(titleLines, 26, y + 8, { lineHeightFactor: 1.18 });
  const rowHeight = Math.max(17, titleLines.length * 3.8 + 9);

  doc.setFont("Roboto", "normal");
  doc.setFontSize(6.2);
  setText(doc, MUTED);
  doc.text(clean(line.unit).toUpperCase(), 26, y + rowHeight - 3.2);

  doc.setFontSize(7.7);
  setText(doc, INK);
  doc.text(Number(line.quantity || 0).toLocaleString("fr-FR"), 139, y + 8, { align: "right" });
  doc.text(money(line.unitPrice), 164, y + 8, { align: "right" });
  doc.setFont("Roboto", "bold");
  doc.text(money(lineTotal(line)), 190, y + 8, { align: "right" });

  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.2);
  doc.line(MARGIN_X, y + rowHeight, PAGE_W - MARGIN_X, y + rowHeight);
  return y + rowHeight;
}

function drawTotals(doc: jsPDF, invoice: PrintableInvoice, y: number) {
  const x = 114;
  const w = 76;
  doc.setFont("Roboto", "normal");
  doc.setFontSize(7.5);
  setText(doc, MUTED);
  doc.text("Total HT", x, y + 6);
  doc.text("TVA", x, y + 15);
  doc.setFont("Roboto", "bold");
  setText(doc, INK);
  doc.text(money(invoice.total), x + w, y + 6, { align: "right" });
  doc.text("Non applicable", x + w, y + 15, { align: "right" });

  doc.setFillColor(...BLUE);
  doc.roundedRect(x, y + 21, w, 22, 2.5, 2.5, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(6.7);
  doc.text("TOTAL TTC · NET À PAYER", x + 7, y + 30);
  doc.setFontSize(14);
  doc.text(money(invoice.total), x + w - 7, y + 35.5, { align: "right" });
  return y + 49;
}

function drawLegal(doc: jsPDF, invoice: PrintableInvoice, y: number) {
  const legal: string[] = [];
  if (invoice.issuer.iban || invoice.issuer.bic) {
    legal.push(`Règlement : ${invoice.issuer.iban ? `IBAN ${invoice.issuer.iban}` : ""}${invoice.issuer.bic ? ` · BIC ${invoice.issuer.bic}` : ""}`);
  }
  legal.push("TVA non applicable, art. L. 223 et suivants du Code des impositions sur les biens et services (CIBS).");
  legal.push("Escompte pour paiement anticipé : néant.");
  if (invoice.client.type === "professional") {
    legal.push(`Pénalités de retard : ${invoice.penaltyRate.toLocaleString("fr-FR")} % exigibles sans rappel préalable. Indemnité forfaitaire de 40 € pour frais de recouvrement.`);
  }

  if (invoice.notes) {
    doc.setFont("Roboto", "bold");
    doc.setFontSize(6.2);
    setText(doc, BLUE);
    doc.text("NOTE", MARGIN_X, y);
    doc.setFont("Roboto", "normal");
    doc.setFontSize(7.2);
    setText(doc, INK);
    const noteLines = doc.splitTextToSize(clean(invoice.notes), 79).slice(0, 4);
    doc.text(noteLines, MARGIN_X, y + 6, { lineHeightFactor: 1.25 });
  }

  const legalY = Math.max(y + (invoice.notes ? 24 : 0), 260);
  doc.setFont("Roboto", "normal");
  doc.setFontSize(5.9);
  setText(doc, MUTED);
  let cursor = legalY;
  for (const paragraph of legal) {
    const lines = doc.splitTextToSize(clean(paragraph), PAGE_W - MARGIN_X * 2);
    doc.text(lines, MARGIN_X, cursor, { lineHeightFactor: 1.2 });
    cursor += lines.length * 2.7 + 1.3;
  }
  doc.setFont("Roboto", "bold");
  doc.setFontSize(5.7);
  setText(doc, BLUE);
  doc.text("PRESTATION DE SERVICES", PAGE_W - MARGIN_X, Math.min(cursor + 2, 279), { align: "right" });
}

export function buildInvoicePdf(invoice: PrintableInvoice) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
  registerFonts(doc);
  let page = 1;
  drawChrome(doc, invoice, page);
  let y = drawTableHeader(doc, drawHeader(doc, invoice));

  for (const line of invoice.lines) {
    doc.setFont("Roboto", "bold");
    doc.setFontSize(8.4);
    const lineCount = doc.splitTextToSize(clean(line.description || "Prestation"), 98).slice(0, 3).length;
    const estimatedHeight = Math.max(17, lineCount * 3.8 + 9);
    if (y + estimatedHeight > 225) {
      doc.addPage();
      page += 1;
      drawChrome(doc, invoice, page);
      y = drawTableHeader(doc, drawHeader(doc, invoice, true));
    }
    y = drawLine(doc, line, y);
  }

  if (y + 55 > 260) {
    doc.addPage();
    page += 1;
    drawChrome(doc, invoice, page);
    y = drawHeader(doc, invoice, true);
  }
  const totalsY = y + 6;
  drawTotals(doc, invoice, totalsY);
  drawLegal(doc, invoice, totalsY + 6);

  doc.setProperties({
    title: `${invoice.documentType === "credit" ? "Avoir" : "Facture"} ${invoice.documentCode || "brouillon"}`,
    subject: "Prestation de services",
    author: invoice.issuer.legal_name,
    creator: "Factures · Émile",
  });
  return doc;
}

export function downloadInvoicePdf(invoice: PrintableInvoice) {
  const doc = buildInvoicePdf(invoice);
  const name = clientName(invoice);
  const filename = `${invoice.documentType === "credit" ? "Avoir" : "Facture"}-${invoice.documentCode || "brouillon"}-${fileSlug(name)}.pdf`;
  doc.save(filename);
  return filename;
}
