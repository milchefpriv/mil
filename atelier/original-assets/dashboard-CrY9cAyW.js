import { r as getJsxRuntime } from "./framework-CXnKph_e.js";
import { c as categoryLabel, i as productIssues } from "./products-BnCPLrh_.js";
import { i as formulaIssues, o as formulaMode } from "./formulas-DJiMSqvq.js";
import { i as SectionTitle, r as ProductThumb } from "./shared-B4bjv9Qj.js";

const jsx = getJsxRuntime();
const STATUS_LABELS = {
  new: "Nouvelle demande",
  contacted: "Contact pris",
  quoted: "Devis envoyé",
  confirmed: "Confirmée",
  done: "Terminée",
  cancelled: "Annulée",
};

const asDate = (value) => {
  if (!value) return null;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(value))
    ? new Date(`${value}T12:00:00`)
    : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const shortDate = (value) => {
  const date = asDate(value);
  return date
    ? new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(date)
    : "Date à définir";
};

const relativeDate = (value) => {
  const date = asDate(value);
  if (!date) return "Date à définir";
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const days = Math.round((date.getTime() - today.getTime()) / 86400000);
  if (days === 0) return "Aujourd’hui";
  if (days === 1) return "Demain";
  if (days > 1) return `Dans ${days} jours`;
  return shortDate(value);
};

const updatedLabel = (value) => {
  const date = asDate(value);
  if (!date) return "Récemment modifiée";
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return "Modifiée aujourd’hui";
  return `Modifiée le ${shortDate(value)}`;
};

function Dashboard({ data, readOnly, onNavigate, onEdit }) {
  const openOrderHistory = () => {
    onNavigate("orders");
    let attempts = 0;
    const selectHistory = () => {
      const historyButton = [...document.querySelectorAll(".view-tabs button")]
        .find((button) => button.textContent?.trim().startsWith("Commandes"));
      if (historyButton) {
        historyButton.click();
      } else if (attempts < 20) {
        attempts += 1;
        window.setTimeout(selectHistory, 50);
      }
    };
    window.setTimeout(selectHistory, 0);
  };

  const activeFormulas = data.formulas.filter((formula) => formula.active);
  const newOrders = (data.orders || [])
    .filter((order) => order.status === "new")
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  const futureOrders = (data.orders || [])
    .filter((order) => !["done", "cancelled"].includes(order.status) && asDate(order.client?.date))
    .filter((order) => asDate(order.client.date).getTime() >= new Date().setHours(0, 0, 0, 0))
    .sort((a, b) => asDate(a.client.date) - asDate(b.client.date));
  const priorityOrder = newOrders[0] || futureOrders[0] || null;
  const readySheets = data.products.filter((product) => productIssues(product).length === 0).length;
  const sheetsToFinish = Math.max(0, data.products.length - readySheets);
  const offerIssues = activeFormulas.flatMap((formula) =>
    formulaIssues(data, formula).map((issue) => `${formulaMode(formula, "ready").name} · ${issue}`),
  );
  const recentProducts = [...data.products]
    .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")))
    .slice(0, 3);

  const workItems = [
    newOrders.length
      ? {
          count: newOrders.length,
          label: `${newOrders.length} demande${newOrders.length > 1 ? "s" : ""} à traiter`,
          note: "Répondre et préparer le devis",
          tone: "urgent",
          action: openOrderHistory,
        }
      : null,
    offerIssues.length
      ? {
          count: offerIssues.length,
          label: `${offerIssues.length} blocage${offerIssues.length > 1 ? "s" : ""} dans l’offre`,
          note: "À corriger avant devis ou dossier",
          tone: "warning",
          action: () => onNavigate("formulas"),
        }
      : null,
    sheetsToFinish
      ? {
          count: sheetsToFinish,
          label: `${sheetsToFinish} fiche${sheetsToFinish > 1 ? "s" : ""} à terminer`,
          note: "Technique, coût ou rendement incomplet",
          tone: "calm",
          action: () => onNavigate("catalogue"),
        }
      : null,
  ].filter(Boolean);

  const todayLabel = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());
  const clientName = priorityOrder?.client?.name || "Client à identifier";
  const orderFormula = priorityOrder?.snapshot?.formulaName || "Formule à définir";
  const guestCount = Number(priorityOrder?.snapshot?.guests || 0);
  const orderIsNew = priorityOrder?.status === "new";

  return jsx.jsxs("div", {
    className: "page dashboard-page dashboard-page-redesign",
    children: [
      jsx.jsxs("section", {
        className: `daily-brief ${priorityOrder ? "has-priority" : "is-clear"}`,
        children: [
          jsx.jsxs("header", {
            className: "daily-brief-head",
            children: [
              jsx.jsx("span", { children: todayLabel }),
              jsx.jsxs("b", {
                children: [
                  jsx.jsx("i", { "aria-hidden": "true" }),
                  newOrders.length
                    ? `${newOrders.length} nouvelle${newOrders.length > 1 ? "s" : ""}`
                    : "Atelier à jour",
                ],
              }),
            ],
          }),
          jsx.jsxs("div", {
            className: "daily-brief-body",
            children: [
              jsx.jsx("span", {
                className: "brief-number",
                "aria-hidden": "true",
                children: priorityOrder ? "01" : "✓",
              }),
              jsx.jsxs("div", {
                className: "brief-copy",
                children: priorityOrder
                  ? [
                      jsx.jsx("span", {
                        className: "brief-kicker",
                        children: orderIsNew ? "PRIORITÉ · DEMANDE REÇUE" : "PROCHAINE PRESTATION",
                      }),
                      jsx.jsx("h2", { children: clientName }),
                      jsx.jsxs("div", {
                        className: "brief-facts",
                        children: [
                          jsx.jsx("span", { children: relativeDate(priorityOrder.client?.date) }),
                          guestCount ? jsx.jsx("span", { children: `${guestCount} personnes` }) : null,
                          jsx.jsx("span", { children: orderFormula }),
                        ],
                      }),
                    ]
                  : [
                      jsx.jsx("span", { className: "brief-kicker", children: "AUCUNE URGENCE" }),
                      jsx.jsx("h2", { children: "Rien ne bloque aujourd’hui." }),
                      jsx.jsx("p", { children: "L’atelier est prêt pour la prochaine demande." }),
                    ],
              }),
              jsx.jsx("button", {
                className: "brief-action",
                onClick: priorityOrder ? openOrderHistory : () => onNavigate("orders"),
                children: priorityOrder
                  ? orderIsNew
                    ? "Traiter la demande"
                    : "Ouvrir la prestation"
                  : "Créer un devis",
              }),
            ],
          }),
          priorityOrder
            ? jsx.jsxs("footer", {
                className: "daily-brief-foot",
                children: [
                  jsx.jsxs("span", {
                    children: ["Statut · ", jsx.jsx("b", { children: STATUS_LABELS[priorityOrder.status] || priorityOrder.status })],
                  }),
                  jsx.jsxs("span", {
                    children: ["Date · ", jsx.jsx("b", { children: shortDate(priorityOrder.client?.date) })],
                  }),
                  priorityOrder.client?.location
                    ? jsx.jsxs("span", {
                        children: ["Lieu · ", jsx.jsx("b", { children: priorityOrder.client.location })],
                      })
                    : null,
                ],
              })
            : null,
        ],
      }),

      jsx.jsxs("section", {
        className: "home-action-grid",
        "aria-label": "Actions rapides",
        children: [
          jsx.jsxs("button", {
            onClick: () => onNavigate("orders"),
            children: [
              jsx.jsx("i", { children: "＋", "aria-hidden": "true" }),
              jsx.jsxs("span", {
                children: [jsx.jsx("b", { children: "Nouveau devis" }), jsx.jsx("small", { children: "Composer et chiffrer" })],
              }),
            ],
          }),
          !readOnly
            ? jsx.jsxs("button", {
                onClick: () => document.querySelector(".topbar .button.primary")?.click(),
                children: [
                  jsx.jsx("i", { children: "✦", "aria-hidden": "true" }),
                  jsx.jsxs("span", {
                    children: [jsx.jsx("b", { children: "Nouvelle recette" }), jsx.jsx("small", { children: "Ajout intelligent" })],
                  }),
                ],
              })
            : null,
          jsx.jsxs("button", {
            onClick: () => onNavigate("formulas"),
            children: [
              jsx.jsx("i", { children: "▦", "aria-hidden": "true" }),
              jsx.jsxs("span", {
                children: [jsx.jsx("b", { children: "Composer l’offre" }), jsx.jsx("small", { children: "Formules et quotas" })],
              }),
            ],
          }),
          jsx.jsxs("a", {
            href: "./questionnaire/",
            children: [
              jsx.jsx("i", { children: "↗", "aria-hidden": "true" }),
              jsx.jsxs("span", {
                children: [jsx.jsx("b", { children: "Questionnaire" }), jsx.jsx("small", { children: "Ouvrir le lien client" })],
              }),
            ],
          }),
        ].filter(Boolean),
      }),

      jsx.jsxs("div", {
        className: "dashboard-work-grid",
        children: [
          jsx.jsxs("section", {
            className: "panel-card work-now-card",
            children: [
              jsx.jsx(SectionTitle, {
                eyebrow: "À FINALISER",
                title: workItems.length ? "Ce qui demande ton attention" : "Tout est prêt",
                action: workItems.length
                  ? jsx.jsx("span", { className: "work-total", children: workItems.reduce((sum, item) => sum + item.count, 0) })
                  : null,
              }),
              workItems.length
                ? jsx.jsx("div", {
                    className: "work-list",
                    children: workItems.map((item) =>
                      jsx.jsxs(
                        "button",
                        {
                          className: item.tone,
                          onClick: item.action,
                          children: [
                            jsx.jsx("strong", { children: item.count }),
                            jsx.jsxs("span", {
                              children: [jsx.jsx("b", { children: item.label }), jsx.jsx("small", { children: item.note })],
                            }),
                            jsx.jsx("em", { children: "→", "aria-hidden": "true" }),
                          ],
                        },
                        item.label,
                      ),
                    ),
                  })
                : jsx.jsxs("div", {
                    className: "home-success",
                    children: [
                      jsx.jsx("i", { children: "✓", "aria-hidden": "true" }),
                      jsx.jsxs("span", {
                        children: [jsx.jsx("b", { children: "Aucun point bloquant" }), jsx.jsx("small", { children: "Offre et fiches cohérentes." })],
                      }),
                    ],
                  }),
              offerIssues.length
                ? jsx.jsx("button", {
                    className: "issue-preview",
                    onClick: () => onNavigate("formulas"),
                    children: offerIssues[0],
                  })
                : null,
            ],
          }),

          jsx.jsxs("section", {
            className: "panel-card resume-card",
            children: [
              jsx.jsx(SectionTitle, {
                eyebrow: "REPRENDRE",
                title: "Dernières recettes",
                action: jsx.jsx("button", {
                  className: "text-button",
                  onClick: () => onNavigate("catalogue"),
                  children: "Tout voir →",
                }),
              }),
              jsx.jsx("div", {
                className: "recent-list home-recent-list",
                children: recentProducts.map((product) =>
                  jsx.jsxs(
                    "button",
                    {
                      onClick: () => onEdit(product),
                      children: [
                        jsx.jsx(ProductThumb, { product }),
                        jsx.jsxs("span", {
                          children: [
                            jsx.jsx("b", { children: product.name }),
                            jsx.jsxs("small", {
                              children: [categoryLabel(product.category), " · ", updatedLabel(product.updatedAt)],
                            }),
                          ],
                        }),
                        jsx.jsx("em", { children: readOnly ? "Voir" : "Continuer" }),
                      ],
                    },
                    product.id,
                  ),
                ),
              }),
            ],
          }),
        ],
      }),

      jsx.jsxs("section", {
        className: "home-library-strip",
        children: [
          jsx.jsxs("button", {
            onClick: () => onNavigate("catalogue"),
            children: [jsx.jsx("strong", { children: data.products.length }), jsx.jsx("span", { children: "recettes" })],
          }),
          jsx.jsxs("button", {
            onClick: () => onNavigate("catalogue"),
            children: [jsx.jsx("strong", { children: `${readySheets}/${data.products.length}` }), jsx.jsx("span", { children: "fiches prêtes" })],
          }),
          jsx.jsxs("button", {
            onClick: () => onNavigate("formulas"),
            children: [jsx.jsx("strong", { children: activeFormulas.length }), jsx.jsx("span", { children: "formules actives" })],
          }),
        ],
      }),
    ],
  });
}

export { Dashboard };
