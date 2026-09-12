import { jsPDF } from "jspdf";
import robotoVfs from "pdfmake/build/vfs_fonts.js";
import {
  augusteSerifBold,
  augusteSerifBoldItalic,
  augusteSerifRegular,
} from "./fonts/auguste-serif.mjs";

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const COURSE_ORDER = ["Entrée", "Plat", "Dessert"];
const COURSE_LABELS = {
  Entrée: "ENTRÉES",
  Plat: "PLATS",
  Dessert: "DESSERTS",
};

const COLORS = {
  paper: [252, 250, 247],
  red: [136, 31, 42],
  ink: [31, 28, 26],
  muted: [112, 104, 97],
  line: [225, 217, 207],
  warm: [178, 139, 92],
};

function cleanText(value) {
  return String(value || "")
    .replaceAll("\u2019", "'")
    .replaceAll("\u2018", "'")
    .replaceAll("\u2013", "-")
    .replaceAll("\u2014", "-")
    .replaceAll("\u2026", "...")
    .replaceAll("\u00a0", " ");
}

function setColor(doc, color) {
  doc.setTextColor(color[0], color[1], color[2]);
}

function tracked(value) {
  return cleanText(value).split("").join(" ");
}

function registerFonts(doc) {
  const fonts = [
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

function registerDrinkFonts(doc) {
  registerFonts(doc);
  doc.addFileToVFS("AugusteSerif-Regular.ttf", augusteSerifRegular);
  doc.addFont("AugusteSerif-Regular.ttf", "AugusteSerif", "normal");
  doc.addFileToVFS("AugusteSerif-Bold.ttf", augusteSerifBold);
  doc.addFont("AugusteSerif-Bold.ttf", "AugusteSerif", "bold");
  doc.addFileToVFS("AugusteSerif-BoldItalic.ttf", augusteSerifBoldItalic);
  doc.addFont("AugusteSerif-BoldItalic.ttf", "AugusteSerif", "bolditalic");
}

function priceLabel(value) {
  const normalized = Number(value || 0).toFixed(2).replace(".", ",");
  return normalized.endsWith(",00") ? normalized.slice(0, -3) : normalized;
}

function fileSlug(value) {
  return cleanText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || "carte";
}

function drawFooter(doc, pageNumber) {
  doc.setDrawColor(...COLORS.line);
  doc.setLineWidth(0.25);
  doc.line(22, 281, 188, 281);
  doc.setFont("Roboto", "normal");
  doc.setFontSize(6.2);
  setColor(doc, COLORS.muted);
  doc.text(tracked("CHEZ AUGUSTE"), 22, 286);
  doc.text("PRIX NETS EN EUROS · SERVICE COMPRIS", 105, 286, { align: "center" });
  doc.setFont("Roboto", "bold");
  setColor(doc, COLORS.ink);
  doc.text(String(pageNumber).padStart(2, "0"), 188, 286, { align: "right" });
}

function drawPage(doc, menuTitle, period, pageNumber, firstPage, logoDataUrl) {
  doc.setFillColor(...COLORS.paper);
  doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, "F");

  if (firstPage) {
    if (logoDataUrl) doc.addImage(logoDataUrl, "PNG", 82, 15, 46, 33.3, undefined, "FAST");
    else {
      doc.setFont("Roboto", "bold");
      doc.setFontSize(17);
      setColor(doc, COLORS.red);
      doc.text(tracked("CHEZ AUGUSTE"), 105, 34, { align: "center" });
    }

    doc.setFont("Roboto", "bold");
    doc.setFontSize(6.2);
    setColor(doc, COLORS.red);
    doc.text(tracked("LA CARTE"), 105, 54, { align: "center" });
    doc.setFont("Roboto", "bold");
    doc.setFontSize(18);
    setColor(doc, COLORS.ink);
    const titleLines = doc.splitTextToSize(cleanText(menuTitle), 150).slice(0, 2);
    doc.text(titleLines, 105, 63, { align: "center", lineHeightFactor: 1.04 });
    const titleBottom = 63 + Math.max(0, titleLines.length - 1) * 6.8;
    doc.setFont("Roboto", "normal");
    doc.setFontSize(6.5);
    setColor(doc, COLORS.muted);
    doc.text(tracked(cleanText(period).toUpperCase()), 105, titleBottom + 7.2, { align: "center" });
    doc.setDrawColor(...COLORS.warm);
    doc.setLineWidth(0.45);
    doc.line(96, titleBottom + 13.5, 114, titleBottom + 13.5);
    drawFooter(doc, pageNumber);
    return titleBottom + 23;
  }

  doc.setFont("Roboto", "bold");
  doc.setFontSize(8);
  setColor(doc, COLORS.red);
  doc.text(tracked("CHEZ AUGUSTE"), 22, 21);
  doc.setFont("Roboto", "normal");
  doc.setFontSize(8.5);
  setColor(doc, COLORS.ink);
  doc.text(cleanText(menuTitle), 188, 21, { align: "right" });
  doc.setDrawColor(...COLORS.line);
  doc.setLineWidth(0.25);
  doc.line(22, 27, 188, 27);
  drawFooter(doc, pageNumber);
  return 38;
}

function drawSectionTitle(doc, label, y, sectionIndex) {
  doc.setFont("Roboto", "normal");
  doc.setFontSize(7);
  setColor(doc, COLORS.warm);
  doc.text(String(sectionIndex + 1).padStart(2, "0"), 24, y);
  doc.setFont("Roboto", "bold");
  doc.setFontSize(8.6);
  setColor(doc, COLORS.red);
  const displayLabel = tracked(label);
  doc.text(displayLabel, 36, y);
  const labelWidth = doc.getTextWidth(displayLabel);
  doc.setDrawColor(...COLORS.line);
  doc.setLineWidth(0.25);
  doc.line(43 + labelWidth, y - 0.7, 186, y - 0.7);
  return y + 9.5;
}

function measureDish(doc, dish) {
  doc.setFont("Roboto", "bold");
  doc.setFontSize(10.6);
  const title = `${cleanText(dish.name)}${dish.vegetarian ? "  (V)" : ""}`;
  const titleLines = doc.splitTextToSize(title, 132);
  doc.setFont("Roboto", "normal");
  doc.setFontSize(7.7);
  const descriptionLines = doc.splitTextToSize(cleanText(dish.description), 152).slice(0, 3);
  const height = titleLines.length * 4.25 + (descriptionLines.length ? descriptionLines.length * 3.3 + 1 : 0) + 4.8;
  return { titleLines, descriptionLines, height };
}

function drawDish(doc, dish, y, measured) {
  doc.setFont("Roboto", "bold");
  doc.setFontSize(10.6);
  setColor(doc, COLORS.ink);
  doc.text(measured.titleLines, 36, y, { lineHeightFactor: 1.06 });

  doc.setFont("Roboto", "normal");
  doc.setFontSize(9.2);
  setColor(doc, COLORS.ink);
  doc.text(`${priceLabel(dish.price)} €`, 184, y, { align: "right" });

  const descriptionY = y + measured.titleLines.length * 4.6 + 0.2;
  if (measured.descriptionLines.length) {
    doc.setFont("Roboto", "normal");
    doc.setFontSize(7.7);
    setColor(doc, COLORS.muted);
    doc.text(measured.descriptionLines, 36, descriptionY, { lineHeightFactor: 1.2 });
  }
  return y + measured.height;
}

/**
 * Build the exact PDF document used by the browser download.
 * @param {{ menuTitle: string, period: string, dishes: Array<{ course: string, name: string, description: string, price: number, vegetarian?: boolean }> }} options
 */
export function buildMenuPdf({ menuTitle, period, dishes, logoDataUrl }) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
  registerFonts(doc);
  const safeTitle = cleanText(menuTitle || "La carte");
  const safePeriod = cleanText(period || "Carte du moment");
  let pageNumber = 1;
  let y = drawPage(doc, safeTitle, safePeriod, pageNumber, true, logoDataUrl);

  for (const [sectionIndex, course] of COURSE_ORDER.entries()) {
    const items = dishes.filter((dish) => dish.course === course);
    if (!items.length) continue;

    if (y + 15 > 270) {
      doc.addPage();
      pageNumber += 1;
      y = drawPage(doc, safeTitle, safePeriod, pageNumber, false, logoDataUrl);
    }
    y = drawSectionTitle(doc, COURSE_LABELS[course], y, sectionIndex);

    for (const dish of items) {
      const measured = measureDish(doc, dish);
      if (y + measured.height > 272) {
        doc.addPage();
        pageNumber += 1;
        y = drawPage(doc, safeTitle, safePeriod, pageNumber, false, logoDataUrl);
        y = drawSectionTitle(doc, `${COURSE_LABELS[course]} - SUITE`, y, sectionIndex);
      }
      y = drawDish(doc, dish, y, measured);
    }
    y += 5;
  }

  doc.setProperties({
    title: `${safeTitle} - Chez Auguste`,
    subject: "Carte du restaurant Chez Auguste",
    author: "Chez Auguste",
    creator: "Le carnet de cuisine Chez Auguste",
  });
  return doc;
}

export function downloadMenuPdf(options) {
  const doc = buildMenuPdf(options);
  const filename = `carte-chez-auguste-${fileSlug(options.period || options.menuTitle)}.pdf`;
  doc.save(filename);
  return filename;
}

const DRINK_COLORS = {
  paper: [249, 245, 235],
  red: [159, 34, 40],
  ink: [48, 39, 31],
  muted: [112, 95, 78],
  line: [202, 174, 146],
  faint: [216, 197, 173],
};

const DRINK_CARD = {
  frameInset: 7.5,
  innerFrameInset: 10.4,
  contentLeft: 17,
  contentRight: 193,
  contentTop: 62,
  contentBottom: 271,
  columnGap: 12,
  winePreferredTop: 202,
};

const WINE_SERVING_COLUMNS = [
  { key: "glass-12", label: "VERRE", format: "12 cl" },
  { key: "pitcher-25", label: "PICHET", format: "25 cl" },
  { key: "pitcher-50", label: "PICHET", format: "50 cl" },
];

function drawSmallDiamond(doc, x, y, size = 1.15) {
  doc.setFillColor(...DRINK_COLORS.red);
  doc.triangle(x, y - size, x + size, y, x, y + size, "F");
  doc.triangle(x, y - size, x - size, y, x, y + size, "F");
}

function drawDrinkCardFrame(doc) {
  doc.setFillColor(...DRINK_COLORS.paper);
  doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, "F");

  const outer = DRINK_CARD.frameInset;
  doc.setDrawColor(...DRINK_COLORS.red);
  doc.setLineWidth(0.3);
  doc.rect(outer, outer, PAGE_WIDTH - outer * 2, PAGE_HEIGHT - outer * 2);

  const inner = DRINK_CARD.innerFrameInset;
  doc.setLineWidth(0.12);
  doc.rect(inner, inner, PAGE_WIDTH - inner * 2, PAGE_HEIGHT - inner * 2);

  drawSmallDiamond(doc, PAGE_WIDTH / 2, inner, 0.8);
  drawSmallDiamond(doc, PAGE_WIDTH / 2, PAGE_HEIGHT - inner, 0.8);
}

function drawDrinkCardHeader(doc, logoDataUrl) {
  if (logoDataUrl) doc.addImage(logoDataUrl, "PNG", 88, 11.5, 34, 24.6, undefined, "FAST");
  else {
    doc.setFont("AugusteSerif", "bold");
    doc.setFontSize(17);
    setColor(doc, DRINK_COLORS.red);
    doc.text("CHEZ AUGUSTE", 105, 30, { align: "center" });
  }

  doc.setFont("AugusteSerif", "bold");
  doc.setFontSize(18.5);
  setColor(doc, DRINK_COLORS.ink);
  doc.text("Carte des boissons", 105, 44.2, { align: "center" });

  doc.setFont("AugusteSerif", "bolditalic");
  doc.setFontSize(7.8);
  setColor(doc, DRINK_COLORS.red);
  doc.text("Boissons · Vins · Cafés", 105, 51, { align: "center" });

  doc.setDrawColor(...DRINK_COLORS.red);
  doc.setLineWidth(0.18);
  doc.line(88, 56.4, 101.2, 56.4);
  doc.line(108.8, 56.4, 122, 56.4);
  drawSmallDiamond(doc, 105, 56.4, 1.15);
}

function drawDrinkCardFooter(doc) {
  doc.setFont("Roboto", "normal");
  doc.setFontSize(5.7);
  setColor(doc, DRINK_COLORS.muted);
  doc.text("PRIX NETS EN EUROS · SERVICE COMPRIS", 105, 281.8, { align: "center" });

  doc.setDrawColor(...DRINK_COLORS.line);
  doc.setLineWidth(0.16);
  doc.line(35, 280.3, 73, 280.3);
  doc.line(137, 280.3, 175, 280.3);
}

function drawDrinkSectionTitle(doc, label, y, x, width, scale) {
  const displayLabel = cleanText(label);
  const baseline = y + 3.8 * scale;
  doc.setFont("AugusteSerif", "bolditalic");
  doc.setFontSize(10.6 * scale);
  setColor(doc, DRINK_COLORS.red);
  const labelWidth = doc.getTextWidth(displayLabel);
  const centerX = x + width / 2;
  doc.text(displayLabel, centerX, baseline, { align: "center" });

  const lineY = baseline - 0.7 * scale;
  const gap = 3 * scale;
  doc.setDrawColor(...DRINK_COLORS.line);
  doc.setLineWidth(0.16);
  if (labelWidth < width - 12 * scale) {
    doc.line(x, lineY, centerX - labelWidth / 2 - gap, lineY);
    doc.line(centerX + labelWidth / 2 + gap, lineY, x + width, lineY);
  }
  return y + 8.25 * scale;
}

const CUSTOMER_CATEGORY_LABELS = {
  "Softs / sodas": "Sodas",
  "Jus & nectars": "Jus de fruits",
  "Bières pression": "Bières & apéritifs",
  "Bières bouteille / canette": "Bières & apéritifs",
  "Cafés / boissons chaudes": "Cafés & boissons chaudes",
  "Autres alcoolisés": "Bières & apéritifs",
  "Autres sans alcool": "Sans alcool",
};

function customerCategoryLabel(category) {
  return CUSTOMER_CATEGORY_LABELS[cleanText(category).trim()] || cleanText(category).trim();
}

function customerDrinkName(name) {
  const label = cleanText(name)
    .trim()
    .replace(/\s*-\s*sirop standard$/i, "")
    .replace(/\s*-\s*standard$/i, "");
  const cubiWine = label.match(/^cubi\s+(.+)$/i);
  if (!cubiWine) return label;
  const customerLabel = cubiWine[1].trim();
  return customerLabel.charAt(0).toLocaleUpperCase("fr") + customerLabel.slice(1).toLocaleLowerCase("fr");
}

function isCustomerReadyDrink(drink) {
  const name = cleanText(drink.name).trim();
  return name
    && cleanText(drink.format).trim()
    && Number(drink.price) > 0;
}

function customerDrinkFormat(format) {
  const label = cleanText(format).trim();
  if (/^(?:1\s+(?:tasse|sachet)|dose\s+\d)/i.test(label)) return "";
  return label;
}

function groupCustomerDrinks(drinks, categories) {
  const sectionOrder = [];
  const sections = new Map();
  const orderedCategories = [...categories, ...drinks.map((drink) => drink.category)]
    .filter((category, index, all) => category && all.indexOf(category) === index);

  for (const category of orderedCategories) {
    const label = customerCategoryLabel(category);
    if (!sections.has(label)) {
      sections.set(label, []);
      sectionOrder.push(label);
    }
    const groups = sections.get(label);
    for (const drink of drinks.filter((item) => item.category === category)) {
      const name = customerDrinkName(drink.name);
      let group = groups.find((item) => item.name.toLocaleLowerCase("fr") === name.toLocaleLowerCase("fr"));
      if (!group) {
        group = { name, variants: [] };
        groups.push(group);
      }
      group.variants.push({ format: customerDrinkFormat(drink.format), price: drink.price });
    }
  }

  return sectionOrder
    .map((label) => ({ label, groups: sections.get(label) || [] }))
    .filter((section) => section.groups.length);
}

function drawDottedLeader(doc, startX, endX, y, scale) {
  if (endX - startX < 3 * scale) return;
  doc.setDrawColor(...DRINK_COLORS.faint);
  doc.setLineWidth(0.12);
  doc.setLineDashPattern([0.3 * scale, 0.9 * scale], 0);
  doc.line(startX, y, endX, y);
  doc.setLineDashPattern([], 0);
}

function measureDrinkGroup(doc, group, width, scale) {
  const rowStep = 4.75 * scale;
  doc.setFont("AugusteSerif", "normal");
  doc.setFontSize(9.5 * scale);
  const titleLines = doc.splitTextToSize(cleanText(group.name), width - 25.5).slice(0, 2);
  const rows = Math.max(titleLines.length, group.variants.length);
  return { titleLines, rowStep, height: rows * rowStep + 1.15 * scale };
}

function drawDrinkGroup(doc, group, y, x, width, scale, measured = measureDrinkGroup(doc, group, width, scale)) {
  const baseline = y + 3.45 * scale;
  doc.setFont("AugusteSerif", "normal");
  doc.setFontSize(9.5 * scale);
  setColor(doc, DRINK_COLORS.ink);
  doc.text(measured.titleLines, x, baseline, { lineHeightFactor: 1.07 });

  const firstLineWidth = doc.getTextWidth(measured.titleLines[0] || "");
  group.variants.forEach((variant, index) => {
    const rowY = baseline + index * measured.rowStep;
    const price = `${priceLabel(variant.price)} €`;
    doc.setFont("AugusteSerif", "bold");
    doc.setFontSize(9 * scale);
    const priceWidth = doc.getTextWidth(price);
    const priceLeft = x + width - priceWidth;

    let leaderEnd = priceLeft - 1.8 * scale;
    if (variant.format) {
      doc.setFont("Roboto", "normal");
      doc.setFontSize(6.8 * scale);
      const formatWidth = doc.getTextWidth(variant.format);
      const formatRight = priceLeft - 3.1 * scale;
      setColor(doc, DRINK_COLORS.muted);
      doc.text(variant.format, formatRight, rowY, { align: "right" });
      leaderEnd = formatRight - formatWidth - 1.5 * scale;
    }

    if (index === 0 && measured.titleLines.length === 1) {
      drawDottedLeader(doc, x + firstLineWidth + 1.5 * scale, leaderEnd, rowY - 0.55 * scale, scale);
    }

    doc.setFont("AugusteSerif", "bold");
    doc.setFontSize(9 * scale);
    setColor(doc, DRINK_COLORS.red);
    doc.text(price, x + width, rowY, { align: "right" });
  });
  return y + measured.height;
}

function wineServingKey(format) {
  const label = cleanText(format).trim().toLocaleLowerCase("fr");
  if (/12\s*cl/.test(label) && (label.includes("verre") || /^12\s*cl$/.test(label))) return "glass-12";
  if (/25\s*cl/.test(label) && (label.includes("pichet") || /^25\s*cl$/.test(label))) return "pitcher-25";
  if (/50\s*cl/.test(label) && (label.includes("pichet") || /^50\s*cl$/.test(label))) return "pitcher-50";
  return "";
}

function isBottleWine(format) {
  return /(?:^|\s)75\s*cl(?:\s|$)/i.test(cleanText(format).trim());
}

function prepareWineRows(section) {
  const servingRows = [];
  const bottleRows = [];
  const otherGroups = [];

  for (const group of section.groups) {
    const servings = new Map();
    const otherVariants = [];
    for (const variant of group.variants) {
      const servingKey = wineServingKey(variant.format);
      if (servingKey) servings.set(servingKey, variant.price);
      else if (isBottleWine(variant.format)) bottleRows.push({ name: group.name, price: variant.price });
      else otherVariants.push(variant);
    }
    if (servings.size) servingRows.push({ name: group.name, servings });
    if (otherVariants.length) otherGroups.push({ name: group.name, variants: otherVariants });
  }
  return { servingRows, bottleRows, otherGroups };
}

function wineServingName(name) {
  const label = cleanText(name);
  if (/^(?:rouge|blanc|rosé)$/i.test(label)) return `Vin ${label.toLocaleLowerCase("fr")}`;
  return label;
}

function wineBottleSideRows(rows) {
  const result = rows.bottleRows.map((row) => ({ name: row.name, detail: "", price: row.price }));
  for (const group of rows.otherGroups) {
    group.variants.forEach((variant, index) => {
      result.push({
        name: index === 0 ? group.name : "",
        detail: variant.format,
        price: variant.price,
      });
    });
  }
  return result;
}

function measureWineSection(doc, section, width, scale) {
  const rows = prepareWineRows(section);
  const bottleSideRows = wineBottleSideRows(rows);
  const servingBody = rows.servingRows.length ? 15.5 + rows.servingRows.length * 5.5 : 0;
  const bottleBody = bottleSideRows.length ? 9.7 + bottleSideRows.length * 5.5 : 0;
  return (9.2 + Math.max(servingBody, bottleBody, 15) + 3.2) * scale;
}

function drawWinePanelHeading(doc, label, x, y, width, scale) {
  doc.setFont("AugusteSerif", "bolditalic");
  doc.setFontSize(8.6 * scale);
  setColor(doc, DRINK_COLORS.red);
  doc.text(cleanText(label), x + width / 2, y, { align: "center" });
  doc.setDrawColor(...DRINK_COLORS.line);
  doc.setLineWidth(0.14);
  doc.line(x + 4 * scale, y + 1.8 * scale, x + width - 4 * scale, y + 1.8 * scale);
}

function drawWineSection(doc, section, y, x, width, scale) {
  const rows = prepareWineRows(section);
  const bottleSideRows = wineBottleSideRows(rows);
  const height = measureWineSection(doc, section, width, scale);
  const titleBaseline = y + 4 * scale;

  doc.setFont("AugusteSerif", "bolditalic");
  doc.setFontSize(11.8 * scale);
  setColor(doc, DRINK_COLORS.red);
  const title = "Les vins";
  const titleWidth = doc.getTextWidth(title);
  const centerX = x + width / 2;
  doc.text(title, centerX, titleBaseline, { align: "center" });
  doc.setDrawColor(...DRINK_COLORS.red);
  doc.setLineWidth(0.18);
  doc.line(x, titleBaseline - 0.7 * scale, centerX - titleWidth / 2 - 4 * scale, titleBaseline - 0.7 * scale);
  doc.line(centerX + titleWidth / 2 + 4 * scale, titleBaseline - 0.7 * scale, x + width, titleBaseline - 0.7 * scale);

  const panelTop = y + 10 * scale;
  const panelGap = 10 * scale;
  const panelWidth = (width - panelGap) / 2;
  const rightX = x + panelWidth + panelGap;
  drawWinePanelHeading(doc, "Au verre & en pichet", x, panelTop, panelWidth, scale);
  drawWinePanelHeading(doc, "En bouteille · 75 cl", rightX, panelTop, panelWidth, scale);

  const dividerX = x + width / 2;
  doc.setDrawColor(...DRINK_COLORS.line);
  doc.setLineWidth(0.13);
  doc.setLineDashPattern([0.75 * scale, 1.15 * scale], 0);
  doc.line(dividerX, panelTop - 2 * scale, dividerX, y + height - 2.4 * scale);
  doc.setLineDashPattern([], 0);

  if (rows.servingRows.length) {
    const nameWidth = 31 * scale;
    const priceXs = WINE_SERVING_COLUMNS.map(
      (_, index) => x + nameWidth + ((panelWidth - nameWidth) / 3) * (index + 0.5),
    );
    doc.setFont("Roboto", "bold");
    doc.setFontSize(4.8 * scale);
    setColor(doc, DRINK_COLORS.muted);
    WINE_SERVING_COLUMNS.forEach((column, index) => {
      doc.text(column.label, priceXs[index], panelTop + 6.1 * scale, { align: "center" });
      doc.setFontSize(5.5 * scale);
      doc.text(column.format, priceXs[index], panelTop + 9.1 * scale, { align: "center" });
      doc.setFontSize(4.8 * scale);
    });

    doc.setDrawColor(...DRINK_COLORS.faint);
    doc.setLineWidth(0.13);
    doc.line(x, panelTop + 10.8 * scale, x + panelWidth, panelTop + 10.8 * scale);

    rows.servingRows.forEach((row, rowIndex) => {
      const rowY = panelTop + (15 + rowIndex * 5.5) * scale;
      doc.setFont("AugusteSerif", "normal");
      doc.setFontSize(9.1 * scale);
      setColor(doc, DRINK_COLORS.ink);
      doc.text(wineServingName(row.name), x, rowY);

      WINE_SERVING_COLUMNS.forEach((column, index) => {
        const price = row.servings.get(column.key);
        if (price === undefined) return;
        doc.setFont("AugusteSerif", "bold");
        doc.setFontSize(8.7 * scale);
        setColor(doc, DRINK_COLORS.red);
        doc.text(`${priceLabel(price)} €`, priceXs[index], rowY, { align: "center" });
      });
    });
  }

  bottleSideRows.forEach((row, rowIndex) => {
    const rowY = panelTop + (8.9 + rowIndex * 5.5) * scale;
    const name = cleanText(row.name);
    const price = `${priceLabel(row.price)} €`;
    doc.setFont("AugusteSerif", "normal");
    doc.setFontSize(8.7 * scale);
    setColor(doc, DRINK_COLORS.ink);
    const label = row.detail ? `${name}${name ? " · " : ""}${cleanText(row.detail)}` : name;
    const lines = doc.splitTextToSize(label, panelWidth - 16 * scale).slice(0, 1);
    doc.text(lines, rightX, rowY);
    const labelWidth = doc.getTextWidth(lines[0] || "");

    doc.setFont("AugusteSerif", "bold");
    doc.setFontSize(8.9 * scale);
    const priceWidth = doc.getTextWidth(price);
    drawDottedLeader(
      doc,
      rightX + labelWidth + 1.4 * scale,
      rightX + panelWidth - priceWidth - 1.7 * scale,
      rowY - 0.55 * scale,
      scale,
    );
    setColor(doc, DRINK_COLORS.red);
    doc.text(price, rightX + panelWidth, rowY, { align: "right" });
  });

  doc.setDrawColor(...DRINK_COLORS.line);
  doc.setLineWidth(0.14);
  doc.line(x, y + height - 1.4 * scale, x + width, y + height - 1.4 * scale);
  return y + height;
}

function measureDrinkSection(doc, section, width, scale) {
  const groupsHeight = section.groups.reduce(
    (total, group) => total + measureDrinkGroup(doc, group, width, scale).height,
    0,
  );
  return 8.25 * scale + groupsHeight + 2.8 * scale;
}

function drawDrinkSection(doc, section, y, x, width, scale) {
  let cursor = drawDrinkSectionTitle(doc, section.label, y, x, width, scale);
  for (const group of section.groups) cursor = drawDrinkGroup(doc, group, cursor, x, width, scale);
  return cursor + 2.8 * scale;
}

function balancedDrinkColumns(doc, sections, width, scale) {
  if (!sections.length) return [[], []];
  if (sections.length === 1) return [sections, []];
  let bestSplit = 1;
  let bestHeight = Number.POSITIVE_INFINITY;
  for (let split = 1; split < sections.length; split += 1) {
    const leftHeight = sections.slice(0, split).reduce(
      (total, section) => total + measureDrinkSection(doc, section, width, scale),
      0,
    );
    const rightHeight = sections.slice(split).reduce(
      (total, section) => total + measureDrinkSection(doc, section, width, scale),
      0,
    );
    const tallestColumn = Math.max(leftHeight, rightHeight);
    if (tallestColumn < bestHeight) {
      bestHeight = tallestColumn;
      bestSplit = split;
    }
  }
  return [sections.slice(0, bestSplit), sections.slice(bestSplit)];
}

function drinkColumnsHeight(doc, columns, width, scale) {
  return Math.max(
    0,
    ...columns.map((column) => column.reduce(
      (total, section) => total + measureDrinkSection(doc, section, width, scale),
      0,
    )),
  );
}

function drawDrinkColumnDivider(doc, top, bottom, scale) {
  if (bottom <= top) return;
  doc.setDrawColor(...DRINK_COLORS.line);
  doc.setLineWidth(0.13);
  doc.setLineDashPattern([0.7 * scale, 1.15 * scale], 0);
  doc.line(PAGE_WIDTH / 2, top, PAGE_WIDTH / 2, bottom);
  doc.setLineDashPattern([], 0);
}

/**
 * Build the customer-facing drinks menu. Purchase prices, suppliers and margin
 * data deliberately stay out of this document.
 * @param {{ drinks: Array<{ category: string, name: string, format: string, price: number }>, categories?: readonly string[], logoDataUrl?: string, targetWindow?: Window | null }} options
 */
export function buildDrinksMenuPdf({ drinks = [], categories = [], logoDataUrl }) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
  registerDrinkFonts(doc);
  const menuDrinks = drinks.filter(isCustomerReadyDrink);
  const sections = groupCustomerDrinks(menuDrinks, categories);
  const wineSection = sections.find((section) => section.label.toLocaleLowerCase("fr") === "vins");
  const regularSections = sections.filter((section) => section !== wineSection);

  drawDrinkCardFrame(doc);
  drawDrinkCardHeader(doc, logoDataUrl);
  drawDrinkCardFooter(doc);

  const contentWidth = DRINK_CARD.contentRight - DRINK_CARD.contentLeft;
  const columnWidth = (contentWidth - DRINK_CARD.columnGap) / 2;
  const availableHeight = DRINK_CARD.contentBottom - DRINK_CARD.contentTop;
  let scale = 1;
  let columns = balancedDrinkColumns(doc, regularSections, columnWidth, scale);
  let topHeight = drinkColumnsHeight(doc, columns, columnWidth, scale);
  let wineHeight = wineSection ? measureWineSection(doc, wineSection, contentWidth, scale) : 0;
  const naturalHeight = topHeight + (wineSection ? 7 * scale + wineHeight : 0);

  if (naturalHeight > availableHeight) {
    scale = availableHeight / naturalHeight;
    columns = balancedDrinkColumns(doc, regularSections, columnWidth, scale);
    topHeight = drinkColumnsHeight(doc, columns, columnWidth, scale);
    wineHeight = wineSection ? measureWineSection(doc, wineSection, contentWidth, scale) : 0;
  }

  columns.forEach((column, columnIndex) => {
    const x = DRINK_CARD.contentLeft + columnIndex * (columnWidth + DRINK_CARD.columnGap);
    let cursor = DRINK_CARD.contentTop;
    for (const section of column) cursor = drawDrinkSection(doc, section, cursor, x, columnWidth, scale);
  });
  drawDrinkColumnDivider(
    doc,
    DRINK_CARD.contentTop - 1.2 * scale,
    DRINK_CARD.contentTop + topHeight - 1.2 * scale,
    scale,
  );

  if (wineSection) {
    let wineY = Math.max(
      DRINK_CARD.winePreferredTop,
      DRINK_CARD.contentTop + topHeight + 6.5 * scale,
    );
    if (wineY + wineHeight > DRINK_CARD.contentBottom) {
      wineY = DRINK_CARD.contentBottom - wineHeight;
    }
    drawWineSection(doc, wineSection, wineY, DRINK_CARD.contentLeft, contentWidth, scale);
  }

  doc.setProperties({
    title: "Carte des boissons - Chez Auguste",
    subject: "Carte des boissons du restaurant Chez Auguste",
    author: "Chez Auguste",
    creator: "Le carnet de cuisine Chez Auguste",
  });
  return doc;
}

export function downloadDrinksMenuPdf(options) {
  const doc = buildDrinksMenuPdf(options);
  const filename = "carte-des-boissons-chez-auguste.pdf";
  const pdfUrl = URL.createObjectURL(doc.output("blob"));
  if (options.targetWindow && !options.targetWindow.closed) {
    options.targetWindow.location.replace(pdfUrl);
  } else {
    const link = document.createElement("a");
    link.href = pdfUrl;
    link.download = filename;
    link.rel = "noopener";
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }
  window.setTimeout(() => URL.revokeObjectURL(pdfUrl), 60_000);
  return filename;
}
const TOTAL_PAGES_TOKEN = "{total_pages_count_string}";

function marginLabel(recipe) {
  const price = Number(recipe.price || 0);
  const cost = Number(recipe.cost || 0);
  return price > 0 ? `${Math.round(((price - cost) / price) * 100)} %` : "-";
}

function quantityLabel(quantity, unit) {
  const value = Number(quantity || 0);
  if (unit === "g" && value >= 1000) return `${(value / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} kg`;
  if (unit === "ml" && value >= 1000) return `${(value / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} L`;
  return `${value.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} ${cleanText(unit)}`;
}

function drawRecipeBookFooter(doc, pageNumber) {
  doc.setDrawColor(...COLORS.line);
  doc.setLineWidth(0.25);
  doc.line(22, 281, 188, 281);
  doc.setFont("Roboto", "normal");
  doc.setFontSize(6.2);
  setColor(doc, COLORS.muted);
  doc.text(tracked("CHEZ AUGUSTE"), 22, 286);
  doc.text("LIVRE DE RECETTES · DOCUMENT DE TRAVAIL", 105, 286, { align: "center" });
  doc.setFont("Roboto", "bold");
  setColor(doc, COLORS.ink);
  doc.text(`${String(pageNumber).padStart(2, "0")} / ${TOTAL_PAGES_TOKEN}`, 188, 286, { align: "right" });
}

function drawRecipeBookCover(doc, recipes, logoDataUrl, pageNumber) {
  doc.setFillColor(...COLORS.paper);
  doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, "F");

  if (logoDataUrl) doc.addImage(logoDataUrl, "PNG", 76, 24, 58, 42, undefined, "FAST");
  else {
    doc.setFont("Roboto", "bold");
    doc.setFontSize(17);
    setColor(doc, COLORS.red);
    doc.text(tracked("CHEZ AUGUSTE"), 105, 48, { align: "center" });
  }

  doc.setFont("Roboto", "bold");
  doc.setFontSize(7);
  setColor(doc, COLORS.red);
  doc.text(tracked("CARNET DE CUISINE"), 105, 83, { align: "center" });
  doc.setFontSize(26);
  setColor(doc, COLORS.ink);
  doc.text("Le livre de recettes", 105, 99, { align: "center" });
  doc.setFont("Roboto", "normal");
  doc.setFontSize(9.5);
  setColor(doc, COLORS.muted);
  doc.text("Fiches techniques imprimables · ingrédients · méthode · coûts", 105, 109, { align: "center" });

  doc.setDrawColor(...COLORS.warm);
  doc.setLineWidth(0.5);
  doc.line(92, 121, 118, 121);

  const counts = COURSE_ORDER.map((course) => ({ course, count: recipes.filter((recipe) => recipe.course === course).length }));
  const startX = 34;
  counts.forEach(({ course, count }, index) => {
    const x = startX + index * 48;
    doc.setFillColor(255, 253, 250);
    doc.setDrawColor(...COLORS.line);
    doc.roundedRect(x, 139, 42, 33, 3, 3, "FD");
    doc.setFont("Roboto", "bold");
    doc.setFontSize(17);
    setColor(doc, COLORS.ink);
    doc.text(String(count), x + 21, 153, { align: "center" });
    doc.setFontSize(6.5);
    setColor(doc, COLORS.red);
    doc.text(tracked(`${course.toUpperCase()}S`), x + 21, 163, { align: "center" });
  });

  doc.setFont("Roboto", "bold");
  doc.setFontSize(34);
  setColor(doc, COLORS.red);
  doc.text(String(recipes.length), 105, 208, { align: "center" });
  doc.setFontSize(7);
  setColor(doc, COLORS.muted);
  doc.text(tracked("RECETTES AU TOTAL"), 105, 218, { align: "center" });
  doc.setFont("Roboto", "normal");
  doc.setFontSize(7);
  doc.text(`Édité le ${new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "long", year: "numeric" }).format(new Date())}`, 105, 236, { align: "center" });
  drawRecipeBookFooter(doc, pageNumber);
}

function drawRecipeContinuationHeader(doc, recipe, pageNumber, label) {
  doc.setFillColor(...COLORS.paper);
  doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, "F");
  doc.setFont("Roboto", "bold");
  doc.setFontSize(7.2);
  setColor(doc, COLORS.red);
  doc.text(tracked("CHEZ AUGUSTE"), 22, 20);
  doc.setFont("Roboto", "normal");
  doc.setFontSize(8);
  setColor(doc, COLORS.ink);
  doc.text(`${cleanText(recipe.name)} · ${label}`, 188, 20, { align: "right" });
  doc.setDrawColor(...COLORS.line);
  doc.line(22, 27, 188, 27);
  drawRecipeBookFooter(doc, pageNumber);
  return 38;
}

function drawRecipeHeader(doc, recipe, pageNumber) {
  doc.setFillColor(...COLORS.paper);
  doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, "F");
  doc.setFont("Roboto", "bold");
  doc.setFontSize(7.2);
  setColor(doc, COLORS.red);
  doc.text(tracked("CHEZ AUGUSTE"), 22, 19);
  doc.setFont("Roboto", "normal");
  doc.setFontSize(6.5);
  setColor(doc, COLORS.muted);
  doc.text(tracked("FICHE TECHNIQUE"), 188, 19, { align: "right" });
  doc.setDrawColor(...COLORS.line);
  doc.line(22, 26, 188, 26);

  doc.setFont("Roboto", "bold");
  doc.setFontSize(6.8);
  setColor(doc, COLORS.red);
  doc.text(tracked(`${cleanText(recipe.course)} · ${cleanText(recipe.family)}`), 22, 37);
  doc.setFontSize(18);
  setColor(doc, COLORS.ink);
  const titleLines = doc.splitTextToSize(cleanText(recipe.name), 158).slice(0, 2);
  doc.text(titleLines, 22, 49, { lineHeightFactor: 1.04 });
  let y = 49 + titleLines.length * 7;

  doc.setFont("Roboto", "normal");
  doc.setFontSize(7.7);
  setColor(doc, COLORS.muted);
  const descriptionLines = doc.splitTextToSize(cleanText(recipe.description), 165).slice(0, 3);
  doc.text(descriptionLines, 22, y, { lineHeightFactor: 1.22 });
  y += Math.max(1, descriptionLines.length) * 3.8 + 7;

  const metrics = [
    ["COÛT / PORTION", `${priceLabel(recipe.cost)} €`],
    ["PRIX CARTE", `${priceLabel(recipe.price)} €`],
    ["MARGE BRUTE", marginLabel(recipe)],
    ["MISE EN PLACE", `${Number(recipe.prep || 0)} min`],
  ];
  metrics.forEach(([label, value], index) => {
    const x = 22 + index * 41.5;
    doc.setFillColor(255, 253, 250);
    doc.setDrawColor(...COLORS.line);
    doc.rect(x, y, 41.5, 22, "FD");
    doc.setFont("Roboto", "normal");
    doc.setFontSize(5.6);
    setColor(doc, COLORS.muted);
    doc.text(label, x + 4, y + 7);
    doc.setFont("Roboto", "bold");
    doc.setFontSize(10.5);
    setColor(doc, COLORS.ink);
    doc.text(value, x + 4, y + 16);
  });
  drawRecipeBookFooter(doc, pageNumber);
  return y + 33;
}

function drawBookSectionTitle(doc, title, y) {
  doc.setFont("Roboto", "bold");
  doc.setFontSize(7);
  setColor(doc, COLORS.red);
  doc.text(tracked(title), 22, y);
  const labelWidth = doc.getTextWidth(tracked(title));
  doc.setDrawColor(...COLORS.line);
  doc.line(28 + labelWidth, y - 0.7, 188, y - 0.7);
  return y + 8;
}

/**
 * Build the printable technical recipe book used by the browser download.
 * @param {{ recipes: Array<object>, portions?: number, logoDataUrl?: string }} options
 */
export function buildRecipeBookPdf({ recipes, portions = 10, logoDataUrl }) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
  registerFonts(doc);
  const orderedRecipes = [...recipes].sort((left, right) => {
    const courseDifference = COURSE_ORDER.indexOf(left.course) - COURSE_ORDER.indexOf(right.course);
    return courseDifference || cleanText(left.name).localeCompare(cleanText(right.name), "fr");
  });
  let pageNumber = 1;
  drawRecipeBookCover(doc, orderedRecipes, logoDataUrl, pageNumber);

  for (const recipe of orderedRecipes) {
    doc.addPage();
    pageNumber += 1;
    let y = drawRecipeHeader(doc, recipe, pageNumber);
    y = drawBookSectionTitle(doc, `INGRÉDIENTS · POUR ${portions} PORTIONS`, y);

    for (const ingredient of recipe.ingredients || []) {
      doc.setFont("Roboto", "normal");
      doc.setFontSize(7.7);
      const nameLines = doc.splitTextToSize(cleanText(ingredient.name), 125);
      const rowHeight = Math.max(7, nameLines.length * 3.5 + 2);
      if (y + rowHeight > 270) {
        doc.addPage();
        pageNumber += 1;
        y = drawRecipeContinuationHeader(doc, recipe, pageNumber, "ingrédients — suite");
        y = drawBookSectionTitle(doc, "INGRÉDIENTS · SUITE", y);
      }
      doc.setDrawColor(...COLORS.line);
      doc.line(22, y + rowHeight - 1.2, 188, y + rowHeight - 1.2);
      setColor(doc, COLORS.ink);
      doc.text(nameLines, 24, y + 2.7, { lineHeightFactor: 1.15 });
      doc.setFont("Roboto", "bold");
      doc.text(quantityLabel(Number(ingredient.quantity || 0) * portions, ingredient.unit), 186, y + 2.7, { align: "right" });
      y += rowHeight;
    }

    y += 8;
    if (y + 18 > 270) {
      doc.addPage();
      pageNumber += 1;
      y = drawRecipeContinuationHeader(doc, recipe, pageNumber, "méthode");
    }
    y = drawBookSectionTitle(doc, "MÉTHODE", y);
    for (const [index, step] of (recipe.steps || []).entries()) {
      doc.setFont("Roboto", "normal");
      doc.setFontSize(7.7);
      const stepLines = doc.splitTextToSize(cleanText(step), 146);
      const rowHeight = Math.max(10, stepLines.length * 3.8 + 3);
      if (y + rowHeight > 270) {
        doc.addPage();
        pageNumber += 1;
        y = drawRecipeContinuationHeader(doc, recipe, pageNumber, "méthode — suite");
        y = drawBookSectionTitle(doc, "MÉTHODE · SUITE", y);
      }
      doc.setFillColor(...COLORS.red);
      doc.circle(27, y + 2, 3.2, "F");
      doc.setFont("Roboto", "bold");
      doc.setFontSize(6.2);
      doc.setTextColor(255, 253, 250);
      doc.text(String(index + 1), 27, y + 2.8, { align: "center" });
      doc.setFont("Roboto", "normal");
      doc.setFontSize(7.7);
      setColor(doc, COLORS.ink);
      doc.text(stepLines, 36, y, { lineHeightFactor: 1.2 });
      y += rowHeight;
    }

    const allergens = (recipe.allergens || []).length ? recipe.allergens.join(" · ") : "Aucun allergène déclaré";
    const allergenLines = doc.splitTextToSize(cleanText(allergens), 135);
    const allergenHeight = Math.max(16, allergenLines.length * 3.5 + 9);
    if (y + allergenHeight + 5 > 270) {
      doc.addPage();
      pageNumber += 1;
      y = drawRecipeContinuationHeader(doc, recipe, pageNumber, "informations");
    }
    y += 5;
    doc.setFillColor(248, 243, 236);
    doc.setDrawColor(...COLORS.line);
    doc.roundedRect(22, y, 166, allergenHeight, 2.5, 2.5, "FD");
    doc.setFont("Roboto", "bold");
    doc.setFontSize(6.2);
    setColor(doc, COLORS.red);
    doc.text("ALLERGÈNES", 27, y + 6);
    doc.setFont("Roboto", "normal");
    doc.setFontSize(7.2);
    setColor(doc, COLORS.ink);
    doc.text(allergenLines, 52, y + 6, { lineHeightFactor: 1.15 });
  }

  if (typeof doc.putTotalPages === "function") doc.putTotalPages(TOTAL_PAGES_TOKEN);
  doc.setProperties({
    title: "Livre de recettes - Chez Auguste",
    subject: "Fiches techniques de cuisine",
    author: "Chez Auguste",
    creator: "Le carnet de cuisine Chez Auguste",
  });
  return doc;
}

export function downloadRecipeBookPdf(options) {
  const doc = buildRecipeBookPdf(options);
  const filename = "livre-recettes-chez-auguste.pdf";
  doc.save(filename);
  return filename;
}
