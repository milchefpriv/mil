import {
  PDFDocument,
  StandardFonts,
  rgb,
  type Color as PdfColor,
  type PDFFont as PdfFont,
  type PDFPage as PdfPage,
} from "pdf-lib";

export type ReportPdfData = {
  firm: {
    name: string;
    address: string;
    contact: string;
  };
  fixedWarning: string;
  fixedReturn: string;
  fixedLegal: string;
  project: {
    name: string;
    address: string;
    details: string;
    siteStart: string;
    kitchenInstall: string;
    siteEnd: string;
  };
  report: {
    meetingNumber: number;
    meetingDate: string;
    attendees: string;
    nextMeetingSentence: string;
    generalNotes: string;
    points: Array<{
      place: string;
      note: string;
      team: string;
    }>;
  };
};

export type PdfDelivery = "downloaded" | "shared" | "cancelled";
export type PdfDeliveryTarget = "auto" | "download" | "share";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 28;
const BODY_WIDTH = PAGE_WIDTH - MARGIN * 2;

function pdfText(value: string) {
  return (value || "")
    .normalize("NFC")
    .replace(/[’‘]/g, "'")
    .replace(/[—–]/g, "-")
    .replace(/œ/g, "oe")
    .replace(/Œ/g, "OE")
    .replace(/…/g, "...")
    .replace(/[^\x20-\x7E\xA0-\xFF\n]/g, "");
}

function splitLongWord(word: string, font: PdfFont, size: number, width: number) {
  const pieces: string[] = [];
  let piece = "";
  [...word].forEach((character) => {
    const candidate = `${piece}${character}`;
    if (piece && font.widthOfTextAtSize(candidate, size) > width) {
      pieces.push(piece);
      piece = character;
    } else {
      piece = candidate;
    }
  });
  if (piece) pieces.push(piece);
  return pieces;
}

function wrapText(value: string, font: PdfFont, size: number, width: number) {
  const result: string[] = [];
  pdfText(value)
    .split("\n")
    .forEach((paragraph) => {
      if (!paragraph.trim()) {
        result.push("");
        return;
      }
      let line = "";
      paragraph.split(/\s+/).forEach((word) => {
        const pieces =
          font.widthOfTextAtSize(word, size) > width
            ? splitLongWord(word, font, size, width)
            : [word];
        pieces.forEach((piece) => {
          const candidate = line ? `${line} ${piece}` : piece;
          if (line && font.widthOfTextAtSize(candidate, size) > width) {
            result.push(line);
            line = piece;
          } else {
            line = candidate;
          }
        });
      });
      if (line) result.push(line);
    });
  return result.length ? result : [""];
}

function drawBox(
  page: PdfPage,
  black: PdfColor,
  x: number,
  top: number,
  width: number,
  height: number,
) {
  page.drawRectangle({
    x,
    y: top - height,
    width,
    height,
    borderColor: black,
    borderWidth: 0.8,
  });
}

function drawLines(
  page: PdfPage,
  lines: string[],
  options: {
    x: number;
    top: number;
    width: number;
    size: number;
    lineHeight: number;
    font: PdfFont;
    color: PdfColor;
    align?: "left" | "center";
  },
) {
  lines.forEach((line, index) => {
    const clean = pdfText(line);
    const textWidth = options.font.widthOfTextAtSize(clean, options.size);
    const x =
      options.align === "center"
        ? options.x + Math.max(0, (options.width - textWidth) / 2)
        : options.x;
    page.drawText(clean, {
      x,
      y: options.top - options.size - index * options.lineHeight,
      size: options.size,
      font: options.font,
      color: options.color,
    });
  });
}

function formatDate(value: string, shortYear = false) {
  if (!value) return "A DEFINIR";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${shortYear ? year.slice(-2) : year}`;
}

function isIosDevice() {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1)
  );
}

export async function downloadReportPdf(
  data: ReportPdfData,
  fileName: string,
  target: PdfDeliveryTarget = "auto",
): Promise<PdfDelivery> {
  const pdfDocument = await PDFDocument.create();
  const regular = await pdfDocument.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDocument.embedFont(StandardFonts.HelveticaBold);
  const black = rgb(0, 0, 0);
  const red = rgb(0.72, 0.05, 0.04);

  let page = pdfDocument.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let cursor = PAGE_HEIGHT - MARGIN;

  const addContinuationPage = (withTableHeader: boolean) => {
    page = pdfDocument.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    cursor = PAGE_HEIGHT - MARGIN;
    const title = `${data.project.name} - CR N°${data.report.meetingNumber}`;
    page.drawText(pdfText(title), {
      x: MARGIN,
      y: cursor - 10,
      size: 9,
      font: bold,
      color: black,
    });
    cursor -= 21;
    if (withTableHeader) drawTableHeader();
  };

  const drawTableHeader = () => {
    const widths = [32, 88, BODY_WIDTH - 32 - 88 - 78, 78];
    const labels = ["N°", "LOCALISATION", "OBJET", "CONCERNE"];
    let x = MARGIN;
    labels.forEach((label, index) => {
      drawBox(page, black, x, cursor, widths[index], 22);
      drawLines(page, [label], {
        x,
        top: cursor - 5,
        width: widths[index],
        size: 7.4,
        lineHeight: 9,
        font: bold,
        color: black,
        align: "center",
      });
      x += widths[index];
    });
    cursor -= 22;
  };

  const rightWidth = 105;
  const leftWidth = BODY_WIDTH - rightWidth;
  const headerHeight = 48;
  drawBox(page, black, MARGIN, cursor, leftWidth, headerHeight);
  drawBox(page, black, MARGIN + leftWidth, cursor, rightWidth, headerHeight);
  drawLines(page, [data.firm.name], {
    x: MARGIN + 9,
    top: cursor - 8,
    width: leftWidth - 18,
    size: 10,
    lineHeight: 11,
    font: bold,
    color: black,
  });
  drawLines(page, [data.firm.address, data.firm.contact], {
    x: MARGIN + 9,
    top: cursor - 22,
    width: leftWidth - 18,
    size: 7.5,
    lineHeight: 9,
    font: regular,
    color: black,
  });
  drawLines(page, [`CR N°${data.report.meetingNumber}`], {
    x: MARGIN + leftWidth,
    top: cursor - 15,
    width: rightWidth,
    size: 11,
    lineHeight: 12,
    font: bold,
    color: black,
    align: "center",
  });
  cursor -= headerHeight;

  const projectLines = [data.project.name, data.project.address];
  if (data.project.details) projectLines.push(data.project.details);
  const projectHeight = Math.max(50, 15 + projectLines.length * 10);
  drawBox(page, black, MARGIN, cursor, leftWidth, projectHeight);
  drawBox(page, black, MARGIN + leftWidth, cursor, rightWidth, projectHeight);
  drawLines(page, [projectLines[0]], {
    x: MARGIN + 9,
    top: cursor - 9,
    width: leftWidth - 18,
    size: 9,
    lineHeight: 10,
    font: bold,
    color: black,
  });
  drawLines(page, projectLines.slice(1), {
    x: MARGIN + 9,
    top: cursor - 23,
    width: leftWidth - 18,
    size: 7.7,
    lineHeight: 9,
    font: regular,
    color: black,
  });
  drawLines(page, ["DATE :", formatDate(data.report.meetingDate)], {
    x: MARGIN + leftWidth,
    top: cursor - 12,
    width: rightWidth,
    size: 8.5,
    lineHeight: 12,
    font: bold,
    color: black,
    align: "center",
  });
  cursor -= projectHeight;

  const attendeeLines = wrapText(
    `PRESENTS : ${data.report.attendees || "A COMPLETER"}`,
    regular,
    8,
    BODY_WIDTH - 16,
  );
  const attendeeHeight = Math.max(27, attendeeLines.length * 10 + 10);
  drawBox(page, black, MARGIN, cursor, BODY_WIDTH, attendeeHeight);
  drawLines(page, attendeeLines, {
    x: MARGIN + 8,
    top: cursor - 6,
    width: BODY_WIDTH - 16,
    size: 8,
    lineHeight: 10,
    font: regular,
    color: black,
  });
  cursor -= attendeeHeight;

  const schedule = [
    `DEBUT DE CHANTIER LE ${formatDate(data.project.siteStart)}`,
    `POSE DE LA CUISINE${data.project.kitchenInstall ? ` LE ${formatDate(data.project.kitchenInstall)}` : ""} - FIN DE CHANTIER ${formatDate(data.project.siteEnd)}`,
  ];
  drawBox(page, black, MARGIN, cursor, BODY_WIDTH, 31);
  drawLines(page, schedule, {
    x: MARGIN + 8,
    top: cursor - 6,
    width: BODY_WIDTH - 16,
    size: 7.3,
    lineHeight: 10,
    font: bold,
    color: black,
  });
  cursor -= 31;

  drawBox(page, black, MARGIN, cursor, BODY_WIDTH, 25);
  drawLines(page, [data.fixedWarning], {
    x: MARGIN,
    top: cursor - 8,
    width: BODY_WIDTH,
    size: 7.8,
    lineHeight: 9,
    font: bold,
    color: red,
    align: "center",
  });
  cursor -= 25;

  drawBox(page, black, MARGIN, cursor, BODY_WIDTH, 21);
  drawLines(page, [data.fixedReturn], {
    x: MARGIN,
    top: cursor - 6,
    width: BODY_WIDTH,
    size: 7.5,
    lineHeight: 9,
    font: bold,
    color: black,
    align: "center",
  });
  cursor -= 21;
  drawTableHeader();

  const widths = [32, 88, BODY_WIDTH - 32 - 88 - 78, 78];
  data.report.points.forEach((point, index) => {
    const values = [String(index + 1), point.place, point.note, point.team];
    const fonts = [regular, regular, regular, regular];
    const lineSets = values.map((value, cellIndex) =>
      wrapText(value, fonts[cellIndex], 7.3, widths[cellIndex] - 10),
    );
    const rowHeight = Math.max(
      22,
      Math.max(...lineSets.map((lines) => lines.length)) * 9 + 8,
    );
    if (cursor - rowHeight < MARGIN + 118) addContinuationPage(true);

    let x = MARGIN;
    lineSets.forEach((lines, cellIndex) => {
      drawBox(page, black, x, cursor, widths[cellIndex], rowHeight);
      drawLines(page, lines, {
        x: x + (cellIndex === 0 ? 0 : 5),
        top: cursor - 5,
        width: widths[cellIndex] - (cellIndex === 0 ? 0 : 10),
        size: 7.3,
        lineHeight: 9,
        font: fonts[cellIndex],
        color: black,
        align: cellIndex === 0 ? "center" : "left",
      });
      x += widths[cellIndex];
    });
    cursor -= rowHeight;
  });

  if (!data.report.points.length) {
    drawBox(page, black, MARGIN, cursor, BODY_WIDTH, 38);
    drawLines(page, ["AUCUN POINT SAISI"], {
      x: MARGIN,
      top: cursor - 14,
      width: BODY_WIDTH,
      size: 8,
      lineHeight: 10,
      font: regular,
      color: black,
      align: "center",
    });
    cursor -= 38;
  }

  if (data.report.generalNotes) {
    const noteLines = wrapText(
      data.report.generalNotes,
      regular,
      7.5,
      BODY_WIDTH - 16,
    );
    const noteHeight = noteLines.length * 9 + 12;
    if (cursor - noteHeight < MARGIN + 100) addContinuationPage(false);
    drawBox(page, black, MARGIN, cursor, BODY_WIDTH, noteHeight);
    drawLines(page, noteLines, {
      x: MARGIN + 8,
      top: cursor - 6,
      width: BODY_WIDTH - 16,
      size: 7.5,
      lineHeight: 9,
      font: regular,
      color: black,
    });
    cursor -= noteHeight;
  }

  const legalLines = wrapText(data.fixedLegal, regular, 6.8, BODY_WIDTH - 18);
  const legalHeight = legalLines.length * 8 + 12;
  const footerHeight = 57 + 10 + legalHeight;
  if (cursor - footerHeight < MARGIN) addContinuationPage(false);
  cursor -= 10;
  drawBox(page, black, MARGIN, cursor, BODY_WIDTH, 57);
  drawLines(
    page,
    [
      `FIN DU CR- ${data.report.meetingNumber}`,
      data.report.nextMeetingSentence,
      "MERCI DE VALIDER VOTRE RECEPTION DE CR, IMPERATIVEMENT",
    ],
    {
      x: MARGIN + 9,
      top: cursor - 8,
      width: BODY_WIDTH - 18,
      size: 7.8,
      lineHeight: 13,
      font: bold,
      color: black,
    },
  );
  cursor -= 67;
  drawBox(page, black, MARGIN, cursor, BODY_WIDTH, legalHeight);
  drawLines(page, legalLines, {
    x: MARGIN + 9,
    top: cursor - 6,
    width: BODY_WIDTH - 18,
    size: 6.8,
    lineHeight: 8,
    font: regular,
    color: black,
  });

  const bytes = await pdfDocument.save();
  const finalName = fileName.toLowerCase().endsWith(".pdf")
    ? fileName
    : `${fileName}.pdf`;
  const pdfArrayBuffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(pdfArrayBuffer).set(bytes);
  const file = new File([pdfArrayBuffer], finalName, {
    type: "application/pdf",
  });

  let canShareFile = false;
  try {
    canShareFile =
      typeof navigator.share === "function" &&
      typeof navigator.canShare === "function" &&
      navigator.canShare({ files: [file] });
  } catch {
    canShareFile = false;
  }

  if (
    canShareFile &&
    (target === "share" || (target === "auto" && isIosDevice()))
  ) {
    try {
      await navigator.share({
        files: [file],
        title:
          target === "share"
            ? `Ajouter à Dropbox — compte rendu n°${data.report.meetingNumber}`
            : `Compte rendu n°${data.report.meetingNumber}`,
      });
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return "cancelled";
      }
      throw error;
    }
  }

  const url = URL.createObjectURL(file);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = finalName;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return "downloaded";
}
