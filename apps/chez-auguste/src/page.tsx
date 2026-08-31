"use client";
/* eslint-disable @next/next/no-img-element -- the local PNG must stay directly embeddable in the one-file offline build */

import { useEffect, useMemo, useRef, useState } from "react";
import { TECHNICAL_RECIPES } from "./technical-recipes";
import BarPilotage from "./bar-pilotage";
import brandLogoUrl from "./assets/chez-auguste-logo.png";
import {
  isNonEmptyPayload,
  loadSharedState,
  saveSharedState,
  subscribeToSharedState,
  type SharedPayload,
} from "./shared-state";

type Course = "Entrée" | "Plat" | "Dessert";
type PeriodType = "Mois" | "Saison";
type DietProfile = "Végétarien" | "Viande" | "Poisson";
type ExtraFilter = "Sans gluten" | "Sans fruits à coque" | "Sans lactose" | "Chaud" | "Froid" | "À partager";

type Dish = {
  id: string;
  name: string;
  course: Course;
  family: string;
  description: string;
  season: string[];
  cost: number;
  price: number;
  prep: number;
  difficulty: 1 | 2 | 3;
  vegetarian?: boolean;
  dietProfile?: DietProfile;
  signature?: boolean;
  allergens: string[];
  tags: string[];
};

type IngredientLine = {
  name: string;
  quantity: number;
  unit: "g" | "ml" | "pièce";
};

type ShoppingLine = IngredientLine;
type ShoppingPlanLine = { dish: Dish; portions: number };

type DishContentOverride = Partial<Pick<Dish, "name" | "course" | "description" | "prep" | "allergens">>;
type TechnicalOverride = { ingredients: IngredientLine[]; steps: string[] };

type SavedMenu = {
  id: string;
  title: string;
  period: string;
  periodType: PeriodType;
  selected: string[];
  targets: Record<Course, number>;
  createdAt: string;
};

type CardSnapshot = {
  title: string;
  period: string;
  periodType: PeriodType;
  selected: string[];
  targets: Record<Course, number>;
  covers: number;
  buffer: number;
  savedAt: string;
};

type HomeProps = {
  userId: string;
  userEmail: string;
  onSignOut: () => void;
};

type SyncStatus = "loading" | "saving" | "synced" | "offline";

function isCardSnapshot(value: unknown): value is CardSnapshot {
  if (!value || typeof value !== "object") return false;
  const card = value as Partial<CardSnapshot>;
  return typeof card.title === "string"
    && typeof card.period === "string"
    && (card.periodType === "Mois" || card.periodType === "Saison")
    && Array.isArray(card.selected)
    && card.selected.every((id) => typeof id === "string")
    && Boolean(card.targets)
    && COURSE_ORDER.every((course) => Number.isFinite(card.targets?.[course]))
    && Number.isFinite(card.covers)
    && Number.isFinite(card.buffer)
    && typeof card.savedAt === "string"
    && !Number.isNaN(Date.parse(card.savedAt));
}

const EMPTY_RECIPE = {
  name: "",
  course: "Entrée" as Course,
  family: "",
  description: "",
  season: "Toute l’année",
  cost: "",
  price: "",
  prep: "30",
  vegetarian: true,
  dietProfile: "Végétarien" as DietProfile,
  allergens: "",
};

const COURSE_ORDER: Course[] = ["Entrée", "Plat", "Dessert"];
const MONTHS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
const SEASONS = ["Printemps", "Été", "Automne", "Hiver"];
const FAMILY_OPTIONS = ["Abats", "Agneau", "Bœuf", "Canard", "Charcuterie", "Chocolat", "Cochon", "Crèmes", "Crustacés", "Fruits", "Légumes", "Œufs", "Pâtisserie", "Poissons", "Salades", "Soupes", "Veau", "Végétal", "Volaille"];
const EXTRA_FILTERS: ExtraFilter[] = ["Sans gluten", "Sans fruits à coque", "Sans lactose", "Chaud", "Froid", "À partager"];
const SHARING_DISH_IDS = new Set(["e3", "e8", "e10", "p3", "p4", "p6", "p10", "d5", "d10"]);
const COLD_DISH_IDS = new Set(["e1", "e2", "e3", "e5", "e6", "e7", "e8", "e9", "e12", "d1", "d2", "d6", "d8", "d9"]);
const APP_STORAGE_KEYS = [
  "auguste-menu-draft",
  "auguste-last-card",
  "auguste-custom-recipes",
  "auguste-saved-menus",
  "auguste-recipe-economics",
  "auguste-recipe-content",
  "auguste-technical-sheets",
  "auguste-period-selections-v1",
] as const;
const BACKUP_DATA_ELEMENT_ID = "auguste-backup-data";
const OFFLINE_CACHE_NAME = "chez-auguste-offline-v24";
const BRAND_LOGO_SRC = typeof brandLogoUrl === "string" ? brandLogoUrl : (brandLogoUrl as { src: string }).src;

const MONTH_TO_SEASON: Record<string, string> = {
  Janvier: "Hiver", Février: "Hiver", Mars: "Printemps", Avril: "Printemps",
  Mai: "Printemps", Juin: "Été", Juillet: "Été", Août: "Été",
  Septembre: "Automne", Octobre: "Automne", Novembre: "Automne", Décembre: "Hiver",
};

const SEASON_TO_MONTH: Record<string, string> = {
  Printemps: "Mars",
  Été: "Juin",
  Automne: "Septembre",
  Hiver: "Décembre",
};

function periodStorageKey(periodType: PeriodType, period: string) {
  return `${periodType}:${period}`;
}

function stablePeriodRank(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

const dishes: Dish[] = [
  { id: "e1", name: "Œuf mimosa Auguste", course: "Entrée", family: "Œufs", description: "Mayonnaise maison, moutarde à l’ancienne et herbes fraîches.", season: ["Toute l’année"], cost: 1.15, price: 7.5, prep: 15, difficulty: 1, signature: true, allergens: ["Œuf", "Moutarde"], tags: ["Bistrot", "Froid"] },
  { id: "e2", name: "Poireaux vinaigrette", course: "Entrée", family: "Légumes", description: "Poireaux fondants, noisettes torréfiées et vinaigrette gribiche.", season: ["Automne", "Hiver", "Printemps"], cost: 1.8, price: 8.5, prep: 25, difficulty: 1, vegetarian: true, allergens: ["Œuf", "Fruits à coque", "Moutarde"], tags: ["Végétarien", "Bistrot"] },
  { id: "e3", name: "Terrine au piment d’Espelette", course: "Entrée", family: "Charcuterie", description: "Terrine maison, salade croquante, cornichons et pain de campagne toasté.", season: ["Toute l’année"], cost: 2.65, price: 9.5, prep: 35, difficulty: 2, signature: true, allergens: ["Gluten", "Sulfites", "Moutarde"], tags: ["Maison", "Canaille", "Froid"] },
  { id: "e4", name: "Velouté de potimarron", course: "Entrée", family: "Soupes", description: "Crème légère, graines de courge et huile de noisette.", season: ["Automne", "Hiver"], cost: 1.45, price: 8, prep: 30, difficulty: 1, vegetarian: true, allergens: ["Lait", "Fruits à coque"], tags: ["Végétarien", "Chaud"] },
  { id: "e5", name: "Harengs pommes à l’huile", course: "Entrée", family: "Poissons", description: "Pommes vapeur, oignons rouges et vinaigrette au vin blanc.", season: ["Automne", "Hiver"], cost: 2.75, price: 10.5, prep: 20, difficulty: 1, allergens: ["Poisson", "Sulfites"], tags: ["Tradition", "Froid"] },
  { id: "e6", name: "Asperges sauce mousseline", course: "Entrée", family: "Légumes", description: "Asperges vertes, mousseline citronnée et cerfeuil.", season: ["Printemps"], cost: 3.1, price: 11, prep: 25, difficulty: 2, vegetarian: true, allergens: ["Œuf", "Lait", "Moutarde"], tags: ["Saisonnier", "Végétarien"] },
  { id: "e7", name: "Tomates anciennes & chèvre", course: "Entrée", family: "Salades", description: "Tomates de plein champ, chèvre frais, basilic et croûtons.", season: ["Été"], cost: 2.6, price: 10, prep: 15, difficulty: 1, vegetarian: true, allergens: ["Lait", "Gluten"], tags: ["Frais", "Végétarien"] },
  { id: "e8", name: "Pâté en croûte pistaché", course: "Entrée", family: "Charcuterie", description: "Volaille et cochon, pistaches, pickles de saison.", season: ["Toute l’année"], cost: 3.55, price: 12.5, prep: 55, difficulty: 3, signature: true, allergens: ["Gluten", "Œuf", "Fruits à coque"], tags: ["Signature", "Maison"] },
  { id: "e9", name: "Céleri rémoulade", course: "Entrée", family: "Légumes", description: "Céleri croquant, pomme verte et noix concassées.", season: ["Automne", "Hiver"], cost: 1.35, price: 7.5, prep: 20, difficulty: 1, vegetarian: true, allergens: ["Œuf", "Moutarde", "Fruits à coque"], tags: ["Végétarien", "Froid"] },
  { id: "e10", name: "Os à moelle rôti", course: "Entrée", family: "Abats", description: "Fleur de sel, persillade et pain frotté à l’ail.", season: ["Automne", "Hiver"], cost: 2.8, price: 11, prep: 22, difficulty: 2, allergens: ["Gluten"], tags: ["Canaille", "Chaud"] },
  { id: "e11", name: "Artichaut à la barigoule", course: "Entrée", family: "Légumes", description: "Petits violets, carotte, vin blanc et herbes du jardin.", season: ["Printemps", "Été"], cost: 2.7, price: 10.5, prep: 35, difficulty: 2, vegetarian: true, allergens: ["Sulfites"], tags: ["Végétarien", "Saisonnier"] },
  { id: "e12", name: "Truite fumée maison", course: "Entrée", family: "Poissons", description: "Crème crue citronnée, concombre et pain de seigle.", season: ["Printemps", "Été"], cost: 3.4, price: 12, prep: 30, difficulty: 2, allergens: ["Poisson", "Lait", "Gluten"], tags: ["Maison", "Frais"] },
  { id: "e13", name: "Melon, jambon & feta", course: "Entrée", family: "Salades", description: "Melon frais, jambon cru, feta et vinaigrette aux herbes.", season: ["Été"], cost: 2.8, price: 10, prep: 15, difficulty: 1, allergens: ["Lait"], tags: ["Froid", "Saisonnier"] },
  { id: "e14", name: "Salade niçoise", course: "Entrée", family: "Salades", description: "Tomate, thon, œuf, haricots verts, olives et anchois.", season: ["Printemps", "Été"], cost: 3.2, price: 11.5, prep: 25, difficulty: 1, allergens: ["Poisson", "Œuf"], tags: ["Froid", "Saisonnier"] },
  { id: "e15", name: "Salade avocat & poulet", course: "Entrée", family: "Salades", description: "Poulet rôti, avocat, salade croquante et sauce douce citronnée.", season: ["Toute l’année"], cost: 3.1, price: 11, prep: 25, difficulty: 1, allergens: ["Moutarde"], tags: ["Froid", "Frais"] },
  { id: "e16", name: "Pissaladière & salade", course: "Entrée", family: "Pâtisserie", description: "Oignons confits, anchois, olives noires et salade d’herbes.", season: ["Toute l’année"], cost: 1.9, price: 8.5, prep: 55, difficulty: 2, allergens: ["Gluten", "Poisson"], tags: ["Maison", "À partager"] },
  { id: "e17", name: "Tomates & mozzarella", course: "Entrée", family: "Salades", description: "Tomates de saison, mozzarella, basilic et huile d’olive.", season: ["Été"], cost: 2.7, price: 10, prep: 15, difficulty: 1, vegetarian: true, allergens: ["Lait"], tags: ["Froid", "Végétarien"] },
  { id: "e18", name: "Gaspacho de tomate", course: "Entrée", family: "Soupes", description: "Tomates mûres, poivron, concombre et huile d’olive.", season: ["Été"], cost: 1.35, price: 7.5, prep: 25, difficulty: 1, vegetarian: true, allergens: [], tags: ["Froid", "Végétarien"] },
  { id: "e19", name: "Salade de betteraves & noix", course: "Entrée", family: "Légumes", description: "Betteraves rôties, noix, chèvre frais et vinaigrette balsamique.", season: ["Automne", "Hiver"], cost: 1.8, price: 8.5, prep: 35, difficulty: 1, vegetarian: true, allergens: ["Lait", "Fruits à coque"], tags: ["Froid", "Végétarien"] },
  { id: "e20", name: "Gaspacho de concombre", course: "Entrée", family: "Soupes", description: "Concombre, yaourt, menthe fraîche et citron.", season: ["Été"], cost: 1.25, price: 7.5, prep: 20, difficulty: 1, vegetarian: true, allergens: ["Lait"], tags: ["Froid", "Végétarien"] },
  { id: "e21", name: "Soupe à l’oignon gratinée", course: "Entrée", family: "Soupes", description: "Oignons longuement confits, bouillon, pain grillé et comté.", season: ["Automne", "Hiver"], cost: 1.55, price: 8.5, prep: 55, difficulty: 2, vegetarian: true, allergens: ["Gluten", "Lait"], tags: ["Chaud", "Réconfort"] },
  { id: "e22", name: "Gaspacho de betterave", course: "Entrée", family: "Soupes", description: "Betterave, pomme verte, vinaigre de cidre et crème légère.", season: ["Été", "Automne"], cost: 1.25, price: 7.5, prep: 20, difficulty: 1, vegetarian: true, allergens: ["Lait"], tags: ["Froid", "Végétarien"] },
  { id: "e23", name: "Stracciatella, figues & chutney", course: "Entrée", family: "Salades", description: "Stracciatella crémeuse, figues fraîches, chutney et pain toasté.", season: ["Été", "Automne"], cost: 3.2, price: 11.5, prep: 20, difficulty: 1, vegetarian: true, allergens: ["Lait", "Gluten"], tags: ["Froid", "Saisonnier"] },
  { id: "e24", name: "Camembert rôti au miel", course: "Entrée", family: "Pâtisserie", description: "Camembert fondant, miel, thym et pain de campagne.", season: ["Toute l’année"], cost: 3, price: 11, prep: 20, difficulty: 1, vegetarian: true, allergens: ["Lait", "Gluten"], tags: ["Chaud", "À partager"] },
  { id: "e25", name: "Rillettes de poisson", course: "Entrée", family: "Poissons", description: "Poisson fumé, fromage frais, citron et pain grillé.", season: ["Toute l’année"], cost: 2.65, price: 9.5, prep: 25, difficulty: 1, allergens: ["Poisson", "Lait", "Gluten"], tags: ["Froid", "Maison"] },
  { id: "e26", name: "Concombre, yaourt & menthe", course: "Entrée", family: "Légumes", description: "Concombre croquant, yaourt grec, menthe et citron.", season: ["Été"], cost: 1.1, price: 7, prep: 15, difficulty: 1, vegetarian: true, allergens: ["Lait"], tags: ["Froid", "Végétarien"] },
  { id: "p1", name: "Saucisse purée, jus réduit", course: "Plat", family: "Cochon", description: "Saucisse artisanale, purée beurrée et jus aux échalotes.", season: ["Toute l’année"], cost: 4.65, price: 17, prep: 35, difficulty: 2, signature: true, allergens: ["Lait", "Sulfites"], tags: ["Signature", "Réconfort"] },
  { id: "p2", name: "Blanquette de veau", course: "Plat", family: "Veau", description: "Riz pilaf, champignons et sauce crémée au citron.", season: ["Automne", "Hiver", "Printemps"], cost: 5.75, price: 19.5, prep: 75, difficulty: 2, signature: true, allergens: ["Lait", "Gluten", "Céleri"], tags: ["Mijoté", "Tradition"] },
  { id: "p3", name: "Bœuf bourguignon, coquillettes", course: "Plat", family: "Bœuf", description: "Carottes, petits oignons, lard fumé et coquillettes au jus.", season: ["Automne", "Hiver"], cost: 5.9, price: 19.5, prep: 120, difficulty: 2, allergens: ["Sulfites", "Céleri", "Gluten"], tags: ["Mijoté", "Canaille"] },
  { id: "p4", name: "Poulet rôti du dimanche", course: "Plat", family: "Volaille", description: "Jus corsé, pommes grenailles et ail confit.", season: ["Toute l’année"], cost: 5.25, price: 18.5, prep: 55, difficulty: 2, allergens: ["Lait"], tags: ["Rôti", "Familial"] },
  { id: "p5", name: "Cabillaud beurre nantais", course: "Plat", family: "Poissons", description: "Poireaux étuvés, pommes fondantes et beurre blanc.", season: ["Automne", "Hiver", "Printemps"], cost: 6.4, price: 21, prep: 35, difficulty: 3, allergens: ["Poisson", "Lait", "Sulfites"], tags: ["Poisson", "Classique"] },
  { id: "p6", name: "Parmentier de canard", course: "Plat", family: "Canard", description: "Effiloché de cuisse, purée maison et salade d’herbes.", season: ["Automne", "Hiver"], cost: 5.15, price: 18.5, prep: 70, difficulty: 2, allergens: ["Lait"], tags: ["Mijoté", "Réconfort"] },
  { id: "p7", name: "Chou farci végétal", course: "Plat", family: "Végétal", description: "Lentilles, champignons, jus de légumes rôti et pomme purée.", season: ["Automne", "Hiver"], cost: 3.1, price: 16, prep: 60, difficulty: 3, vegetarian: true, allergens: ["Céleri", "Lait"], tags: ["Végétarien", "Mijoté"] },
  { id: "p8", name: "Truite meunière", course: "Plat", family: "Poissons", description: "Amandes, citron, persil et pommes vapeur.", season: ["Printemps", "Été"], cost: 5.6, price: 19.5, prep: 30, difficulty: 2, allergens: ["Poisson", "Lait", "Gluten", "Fruits à coque"], tags: ["Poisson", "Poêlé"] },
  { id: "p9", name: "Tête de veau gribiche", course: "Plat", family: "Abats", description: "Légumes du pot, sauce gribiche et câpres.", season: ["Automne", "Hiver"], cost: 4.2, price: 18, prep: 95, difficulty: 3, allergens: ["Œuf", "Moutarde", "Céleri"], tags: ["Canaille", "Tradition"] },
  { id: "p10", name: "Petit salé aux lentilles", course: "Plat", family: "Cochon", description: "Palette demi-sel, saucisse fumée et lentilles vertes.", season: ["Automne", "Hiver"], cost: 4.75, price: 17.5, prep: 85, difficulty: 2, allergens: ["Céleri"], tags: ["Mijoté", "Terroir"] },
  { id: "p11", name: "Gnocchis de courge", course: "Plat", family: "Végétal", description: "Crème de parmesan, sauge frite et noisettes.", season: ["Automne", "Hiver"], cost: 3.45, price: 16.5, prep: 55, difficulty: 3, vegetarian: true, allergens: ["Gluten", "Œuf", "Lait", "Fruits à coque"], tags: ["Végétarien", "Maison"] },
  { id: "p12", name: "Navarin d’agneau printanier", course: "Plat", family: "Agneau", description: "Petits légumes nouveaux, jus clair et persil plat.", season: ["Printemps"], cost: 6.1, price: 20.5, prep: 90, difficulty: 2, allergens: ["Céleri"], tags: ["Mijoté", "Saisonnier"] },
  { id: "p13", name: "Tomate farcie & riz pilaf", course: "Plat", family: "Cochon", description: "Farce de cochon aux herbes, tomate confite et jus court.", season: ["Été"], cost: 4.1, price: 17, prep: 55, difficulty: 2, allergens: ["Œuf", "Gluten"], tags: ["Saisonnier", "Familial"] },
  { id: "p14", name: "Aubergine rôtie, pois chiches", course: "Plat", family: "Végétal", description: "Aubergine laquée, pois chiches au cumin et yaourt citronné.", season: ["Été"], cost: 2.95, price: 15.5, prep: 45, difficulty: 2, vegetarian: true, allergens: ["Lait", "Sésame"], tags: ["Végétarien", "Saisonnier"] },
  { id: "p15", name: "Steak au poivre", course: "Plat", family: "Bœuf", description: "Frites maison, sauce au poivre et salade croquante.", season: ["Toute l’année"], cost: 7.2, price: 23, prep: 25, difficulty: 2, allergens: ["Lait", "Sulfites"], tags: ["Grill", "Bistrot"] },
  { id: "p16", name: "Quenelle de brochet", course: "Plat", family: "Poissons", description: "Sauce Nantua, riz pilaf et jeunes pousses.", season: ["Automne", "Hiver", "Printemps"], cost: 5.35, price: 19, prep: 65, difficulty: 3, allergens: ["Poisson", "Crustacés", "Lait", "Œuf", "Gluten"], tags: ["Maison", "Tradition"] },
  { id: "p17", name: "Croque-monsieur, frites & salade", course: "Plat", family: "Cochon", description: "Pain de mie doré, jambon blanc, emmental, frites maison et salade.", season: ["Toute l’année"], cost: 4.2, price: 16.5, prep: 30, difficulty: 2, allergens: ["Gluten", "Lait", "Moutarde"], tags: ["Bistrot", "Chaud"] },
  { id: "p18", name: "Tartare de bœuf au couteau", course: "Plat", family: "Bœuf", description: "Assaisonné minute, frites maison et salade croquante.", season: ["Toute l’année"], cost: 6.8, price: 21, prep: 25, difficulty: 2, allergens: ["Œuf", "Moutarde", "Sulfites"], tags: ["Bistrot", "Froid"] },
  { id: "p19", name: "Saumon, riz pilaf & haricots verts", course: "Plat", family: "Poissons", description: "Pavé de saumon rôti, riz pilaf, haricots verts et beurre citronné.", season: ["Toute l’année"], cost: 6.5, price: 21, prep: 35, difficulty: 2, allergens: ["Poisson", "Lait"], tags: ["Poisson", "Chaud"] },
  { id: "p20", name: "Bouillabaisse", course: "Plat", family: "Poissons", description: "Poissons de roche, soupe safranée, pommes de terre et rouille.", season: ["Toute l’année"], cost: 7.4, price: 24, prep: 90, difficulty: 3, allergens: ["Poisson", "Crustacés", "Œuf", "Gluten"], tags: ["Chaud", "Tradition"] },
  { id: "p21", name: "Quenelle de saumon & épinards", course: "Plat", family: "Poissons", description: "Quenelle maison, épinards tombés et sauce crémée.", season: ["Automne", "Hiver", "Printemps"], cost: 5.4, price: 19, prep: 60, difficulty: 3, allergens: ["Poisson", "Œuf", "Lait", "Gluten"], tags: ["Maison", "Chaud"] },
  { id: "p22", name: "Poulet basquaise, riz pilaf", course: "Plat", family: "Volaille", description: "Poulet mijoté, poivrons, tomate, piment doux et riz pilaf.", season: ["Été", "Automne"], cost: 4.9, price: 18, prep: 70, difficulty: 2, allergens: [], tags: ["Mijoté", "Chaud"] },
  { id: "p23", name: "Rôti, jus corsé & haricots verts", course: "Plat", family: "Bœuf", description: "Rôti de bœuf, jus réduit, haricots verts et échalotes.", season: ["Toute l’année"], cost: 6.4, price: 21, prep: 65, difficulty: 2, allergens: ["Lait", "Sulfites"], tags: ["Rôti", "Chaud"] },
  { id: "p24", name: "Moussaka", course: "Plat", family: "Agneau", description: "Aubergines rôties, agneau mijoté, tomate et béchamel gratinée.", season: ["Été", "Automne"], cost: 4.5, price: 17.5, prep: 80, difficulty: 2, allergens: ["Lait", "Gluten"], tags: ["Mijoté", "Chaud"] },
  { id: "p25", name: "Ratatouille & riz pilaf", course: "Plat", family: "Végétal", description: "Légumes du soleil confits séparément, basilic et riz pilaf.", season: ["Été"], cost: 2.6, price: 15, prep: 55, difficulty: 2, vegetarian: true, allergens: [], tags: ["Végétarien", "Chaud"] },
  { id: "p26", name: "Côte d’agneau en croûte d’herbes", course: "Plat", family: "Agneau", description: "Côte d’agneau rôtie, croûte d’herbes et courgettes poêlées.", season: ["Printemps", "Été"], cost: 7.2, price: 23, prep: 45, difficulty: 3, allergens: ["Gluten", "Lait"], tags: ["Rôti", "Saisonnier"] },
  { id: "p27", name: "Salade quinoa, patate douce & chèvre", course: "Plat", family: "Végétal", description: "Quinoa, patate douce rôtie, chèvre, jeunes pousses et graines.", season: ["Toute l’année"], cost: 3.2, price: 15.5, prep: 35, difficulty: 1, vegetarian: true, allergens: ["Lait"], tags: ["Végétarien", "Froid"] },
  { id: "p28", name: "Courgette farcie & riz pilaf", course: "Plat", family: "Végétal", description: "Courgette farcie aux légumes, herbes fraîches et riz pilaf.", season: ["Été"], cost: 2.8, price: 15, prep: 55, difficulty: 2, vegetarian: true, allergens: ["Gluten", "Œuf"], tags: ["Végétarien", "Chaud"] },
  { id: "p29", name: "Navarin de poisson blanc", course: "Plat", family: "Poissons", description: "Poisson blanc, légumes nouveaux, bouillon crémé et herbes.", season: ["Printemps"], cost: 5.8, price: 20, prep: 55, difficulty: 2, allergens: ["Poisson", "Lait", "Céleri"], tags: ["Mijoté", "Saisonnier"] },
  { id: "d1", name: "Mousse au chocolat", course: "Dessert", family: "Chocolat", description: "Chocolat noir, pointe de fleur de sel et tuile cacao.", season: ["Toute l’année"], cost: 1.35, price: 7.5, prep: 25, difficulty: 1, signature: true, vegetarian: true, allergens: ["Œuf", "Lait", "Gluten"], tags: ["Maison", "Gourmand"] },
  { id: "d2", name: "Île flottante", course: "Dessert", family: "Crèmes", description: "Crème anglaise vanillée, caramel et amandes grillées.", season: ["Toute l’année"], cost: 1.2, price: 7, prep: 30, difficulty: 2, vegetarian: true, allergens: ["Œuf", "Lait", "Fruits à coque"], tags: ["Classique", "Léger"] },
  { id: "d3", name: "Tarte Tatin", course: "Dessert", family: "Fruits", description: "Pommes caramélisées, pâte croustillante et crème crue.", season: ["Automne", "Hiver"], cost: 1.65, price: 8, prep: 45, difficulty: 2, vegetarian: true, allergens: ["Gluten", "Lait"], tags: ["Saisonnier", "Maison"] },
  { id: "d4", name: "Riz au lait d’Auguste", course: "Dessert", family: "Crèmes", description: "Vanille, caramel beurre salé et riz soufflé.", season: ["Toute l’année"], cost: 1.05, price: 7, prep: 40, difficulty: 1, signature: true, vegetarian: true, allergens: ["Lait"], tags: ["Signature", "Réconfort"] },
  { id: "d5", name: "Paris-Brest minute", course: "Dessert", family: "Pâtisserie", description: "Pâte à choux, crème pralinée et noisettes torréfiées.", season: ["Toute l’année"], cost: 2.05, price: 9, prep: 50, difficulty: 3, vegetarian: true, allergens: ["Gluten", "Œuf", "Lait", "Fruits à coque"], tags: ["Pâtisserie", "Gourmand"] },
  { id: "d6", name: "Fraises, crème crue", course: "Dessert", family: "Fruits", description: "Fraises françaises, crème montée et sablé breton.", season: ["Printemps", "Été"], cost: 2.35, price: 8.5, prep: 20, difficulty: 1, vegetarian: true, allergens: ["Lait", "Gluten", "Œuf"], tags: ["Frais", "Saisonnier"] },
  { id: "d7", name: "Clafoutis aux cerises", course: "Dessert", family: "Fruits", description: "Cerises entières, appareil vanillé et crème épaisse.", season: ["Été"], cost: 1.75, price: 7.5, prep: 35, difficulty: 1, vegetarian: true, allergens: ["Gluten", "Œuf", "Lait"], tags: ["Saisonnier", "Familial"] },
  { id: "d8", name: "Poire pochée au vin", course: "Dessert", family: "Fruits", description: "Épices douces, ganache chocolat et éclats de noisette.", season: ["Automne", "Hiver"], cost: 1.9, price: 8.5, prep: 35, difficulty: 2, vegetarian: true, allergens: ["Lait", "Fruits à coque", "Sulfites"], tags: ["Saisonnier", "Élégant"] },
  { id: "d9", name: "Crème caramel", course: "Dessert", family: "Crèmes", description: "Crème prise à la vanille et caramel ambré.", season: ["Toute l’année"], cost: 0.95, price: 6.5, prep: 25, difficulty: 1, vegetarian: true, allergens: ["Œuf", "Lait"], tags: ["Classique", "Petit coût"] },
  { id: "d10", name: "Profiterole géante", course: "Dessert", family: "Chocolat", description: "Glace vanille, sauce chocolat chaud et amandes.", season: ["Toute l’année"], cost: 2.15, price: 9, prep: 35, difficulty: 2, vegetarian: true, allergens: ["Gluten", "Œuf", "Lait", "Fruits à coque"], tags: ["Gourmand", "Spectacle"] },
  { id: "d11", name: "Mirabelles rôties", course: "Dessert", family: "Fruits", description: "Mirabelles au miel, fromage blanc et crumble d’avoine.", season: ["Été", "Automne"], cost: 1.7, price: 8, prep: 25, difficulty: 1, vegetarian: true, allergens: ["Lait", "Gluten"], tags: ["Saisonnier", "Frais"] },
  { id: "d12", name: "Baba au rhum", course: "Dessert", family: "Pâtisserie", description: "Sirop brun, chantilly vanillée et agrumes confits.", season: ["Toute l’année"], cost: 1.75, price: 8.5, prep: 55, difficulty: 3, vegetarian: true, allergens: ["Gluten", "Œuf", "Lait", "Alcool"], tags: ["Classique", "Maison"] },
  { id: "d13", name: "Crème brûlée", course: "Dessert", family: "Crèmes", description: "Crème vanillée lentement cuite et fine croûte de cassonade caramélisée.", season: ["Toute l’année"], cost: 1.15, price: 7.5, prep: 45, difficulty: 2, vegetarian: true, allergens: ["Œuf", "Lait"], tags: ["Classique", "Maison", "Froid"] },
  { id: "d14", name: "Crumble aux pommes", course: "Dessert", family: "Fruits", description: "Pommes fondantes à la cannelle et crumble pur beurre croustillant.", season: ["Automne", "Hiver", "Toute l’année"], cost: 1.35, price: 7.5, prep: 40, difficulty: 1, vegetarian: true, allergens: ["Gluten", "Lait"], tags: ["Maison", "Réconfort", "Chaud"] },
  { id: "d15", name: "Fondant au chocolat", course: "Dessert", family: "Chocolat", description: "Cœur coulant au chocolat noir et crème légère.", season: ["Toute l’année"], cost: 1.6, price: 8, prep: 30, difficulty: 2, vegetarian: true, allergens: ["Œuf", "Lait", "Gluten"], tags: ["Chaud", "Gourmand"] },
  { id: "d16", name: "Panna cotta aux fruits rouges", course: "Dessert", family: "Crèmes", description: "Crème vanillée, coulis acidulé et fruits rouges frais.", season: ["Printemps", "Été"], cost: 1.45, price: 7.5, prep: 25, difficulty: 1, vegetarian: true, allergens: ["Lait"], tags: ["Froid", "Frais"] },
  { id: "d17", name: "Financier noisette & yaourt", course: "Dessert", family: "Pâtisserie", description: "Financier moelleux, crème de yaourt et noisettes torréfiées.", season: ["Toute l’année"], cost: 1.55, price: 8, prep: 35, difficulty: 2, vegetarian: true, allergens: ["Gluten", "Œuf", "Lait", "Fruits à coque"], tags: ["Maison", "Gourmand"] },
  { id: "d18", name: "Poire gingembre & chocolat", course: "Dessert", family: "Fruits", description: "Poire pochée au gingembre, chocolat noir et éclats croquants.", season: ["Automne", "Hiver"], cost: 1.85, price: 8.5, prep: 40, difficulty: 2, vegetarian: true, allergens: ["Lait"], tags: ["Saisonnier", "Élégant"] },
  { id: "d19", name: "Assiette de fromages", course: "Dessert", family: "Crèmes", description: "Sélection de trois fromages, salade et condiment de saison.", season: ["Toute l’année"], cost: 3.1, price: 10.5, prep: 10, difficulty: 1, vegetarian: true, allergens: ["Lait"], tags: ["Froid", "À partager"] },
];

const euro = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
function getMargin(dish: Dish) { return Math.round(((dish.price - dish.cost) / dish.price) * 100); }
function getDietProfile(dish: Pick<Dish, "dietProfile" | "vegetarian" | "family">): DietProfile {
  if (dish.dietProfile) return dish.dietProfile;
  if (dish.vegetarian) return "Végétarien";
  if (["Poissons", "Crustacés"].includes(dish.family)) return "Poisson";
  return "Viande";
}

function matchesExtraFilter(dish: Dish, filter: ExtraFilter) {
  if (filter === "Sans gluten") return !dish.allergens.includes("Gluten");
  if (filter === "Sans fruits à coque") return !dish.allergens.includes("Fruits à coque");
  if (filter === "Sans lactose") return !dish.allergens.includes("Lait");
  if (filter === "À partager") return SHARING_DISH_IDS.has(dish.id) || dish.tags.includes("À partager");
  const isCold = COLD_DISH_IDS.has(dish.id) || dish.tags.some((tag) => ["Froid", "Frais"].includes(tag));
  if (filter === "Froid") return isCold;
  return !isCold && (dish.course === "Plat" || dish.tags.some((tag) => ["Chaud", "Mijoté", "Rôti", "Poêlé", "Grill", "Réconfort"].includes(tag)));
}

function normalizedText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr");
}

function formatShoppingQuantity(item: ShoppingLine) {
  if (item.unit === "pièce") {
    const quantity = Math.ceil(item.quantity);
    return `${quantity} pièce${quantity > 1 ? "s" : ""}`;
  }
  if (item.unit === "g" && item.quantity >= 1000) {
    return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(Math.ceil(item.quantity / 10) / 100)} kg`;
  }
  if (item.unit === "ml" && item.quantity >= 1000) {
    return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(Math.ceil(item.quantity / 10) / 100)} L`;
  }
  const step = item.quantity >= 100 ? 10 : item.quantity >= 20 ? 5 : 1;
  return `${Math.ceil(item.quantity / step) * step} ${item.unit}`;
}

function escapePrintText(value: string) {
  const characters: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return value.replace(/[&<>"']/g, (character) => characters[character]);
}

function loadImageAsDataUrl(source: string): Promise<string> {
  if (source.startsWith("data:")) return Promise.resolve(source);
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      canvas.getContext("2d")?.drawImage(image, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    image.onerror = () => reject(new Error("Logo indisponible"));
    image.src = source;
  });
}

function safeJsonForHtml(value: unknown) {
  return JSON.stringify(value)
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026");
}

function addBackupDataToHtml(template: string, payload: unknown) {
  const backupTag = new RegExp(`(<script\\s+id=["']${BACKUP_DATA_ELEMENT_ID}["'][^>]*>)[\\s\\S]*?(<\\/script>)`, "i");
  if (!backupTag.test(template)) throw new Error("Le point de sauvegarde est absent du fichier autonome.");
  return template.replace(backupTag, (_match, openingTag: string, closingTag: string) => `${openingTag}${safeJsonForHtml(payload)}${closingTag}`);
}

function isAppleMobileBrowser() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

async function downloadHtmlFile(html: string, filename: string): Promise<"shared" | "downloaded" | "cancelled"> {
  const file = new File([html], filename, { type: "text/html;charset=utf-8" });
  if (isAppleMobileBrowser() && typeof navigator.share === "function" && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: "Sauvegarde Chez Auguste",
        text: "Sauvegarde complète du logiciel et de ses données locales.",
      });
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
      console.warn("Le partage iPhone n’est pas disponible, téléchargement classique utilisé.", error);
    }
  }

  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  return "downloaded";
}

function classifyRecipeTitle(title: string) {
  const text = normalizedText(title);
  const has = (...words: string[]) => words.some((word) => text.includes(word));
  const sweetFruit = has("pomme", "poire", "fraise", "cerise", "abricot", "peche", "mirabelle");
  const dessert = has("mousse", "tarte", "gateau", "creme", "glace", "sorbet", "clafoutis", "baba", "profiterole", "chocolat", "caramel", "riz au lait", "flan") || (sweetFruit && has("rotie", "pochee", "compote", "crumble", "miel", "vanille", "chantilly"));
  const starter = !dessert && has("oeuf", "mimosa", "terrine", "veloute", "soupe", "salade", "poireaux", "asperge", "celeri", "hareng", "pate en croute", "os a moelle", "artichaut", "rillettes");
  const course: Course = dessert ? "Dessert" : starter ? "Entrée" : "Plat";

  let family = dessert ? "Pâtisserie" : "Cuisine";
  if (has("boeuf", "steak", "bourguignon", "joue")) family = "Bœuf";
  else if (has("veau", "blanquette")) family = "Veau";
  else if (has("agneau", "mouton")) family = "Agneau";
  else if (has("canard")) family = "Canard";
  else if (has("poulet", "volaille", "dinde", "pintade")) family = "Volaille";
  else if (has("porc", "cochon", "saucisse", "boudin", "jambon", "lard")) family = "Cochon";
  else if (has("truite", "cabillaud", "saumon", "hareng", "dorade", "brochet", "poisson")) family = "Poissons";
  else if (has("crevette", "homard", "crabe", "langoustine")) family = "Crustacés";
  else if (has("oeuf", "mimosa")) family = "Œufs";
  else if (has("veloute", "soupe", "potage")) family = "Soupes";
  else if (has("terrine", "pate", "rillettes")) family = "Charcuterie";
  else if (has("salade")) family = "Salades";
  else if (has("legume", "aubergine", "tomate", "chou", "courge", "poireau", "asperge", "celeri", "artichaut", "lentille")) family = course === "Plat" ? "Végétal" : "Légumes";
  else if (has("chocolat", "cacao", "profiterole")) family = "Chocolat";
  else if (has("creme", "flan", "riz au lait", "ile flottante", "caramel")) family = "Crèmes";
  else if (dessert && has("pomme", "poire", "fraise", "cerise", "abricot", "peche", "fruit")) family = "Fruits";

  let season = "Toute l’année";
  if (has("fraise", "asperge", "petit pois", "rhubarbe")) season = "Printemps";
  else if (has("tomate", "aubergine", "courgette", "melon", "cerise", "peche", "abricot")) season = "Été";
  else if (has("courge", "potimarron", "champignon", "poire", "pomme", "celeri", "mirabelle")) season = "Automne";
  else if (has("chou", "endive", "poireau", "navet")) season = "Hiver";

  const animal = has("boeuf", "veau", "agneau", "mouton", "canard", "poulet", "volaille", "dinde", "pintade", "porc", "cochon", "saucisse", "boudin", "jambon", "lard", "truite", "cabillaud", "saumon", "hareng", "dorade", "brochet", "poisson", "crevette", "homard", "crabe", "langoustine");
  const vegetarian = !animal;
  const dietProfile: DietProfile = ["Poissons", "Crustacés"].includes(family) ? "Poisson" : animal ? "Viande" : "Végétarien";
  const allergens = new Set<string>();
  if (family === "Poissons") allergens.add("Poisson");
  if (family === "Crustacés") allergens.add("Crustacés");
  if (dessert || has("pate", "gnocchi", "pain", "tarte")) allergens.add("Gluten");
  if (dessert || has("oeuf", "mimosa", "mayonnaise")) allergens.add("Œuf");
  if (dessert || has("creme", "beurre", "fromage", "puree")) allergens.add("Lait");
  if (has("moutarde", "gribiche")) allergens.add("Moutarde");
  if (has("noisette", "amande", "pistache", "noix")) allergens.add("Fruits à coque");

  const premium = ["Bœuf", "Veau", "Agneau", "Canard", "Poissons", "Crustacés"].includes(family);
  const cost = course === "Entrée" ? 2.4 : course === "Dessert" ? 1.6 : premium ? 5.5 : 3.4;
  const price = course === "Entrée" ? 9.5 : course === "Dessert" ? 8 : premium ? 19.5 : 16.5;
  const description = course === "Dessert"
    ? "Préparation maison, texture gourmande et finition de saison."
    : course === "Entrée"
      ? "Préparation maison, assaisonnement vif et herbes fraîches."
      : "Cuisson maîtrisée, garniture de saison et jus maison.";

  return {
    ...EMPTY_RECIPE,
    name: title.trim(),
    course,
    family,
    description,
    season,
    cost: cost.toFixed(2).replace(".", ","),
    price: price.toFixed(2).replace(".", ","),
    prep: course === "Dessert" ? "35" : premium ? "60" : "40",
    vegetarian,
    dietProfile,
    allergens: [...allergens].join(", "),
  };
}

function buildTechnicalIngredients(dish: Dish): IngredientLine[] {
  const preset = TECHNICAL_RECIPES[dish.id];
  if (preset) return preset.ingredients.map((ingredient) => ({ ...ingredient }));
  const text = normalizedText(`${dish.name} ${dish.description}`);
  const primaryByFamily: Record<string, IngredientLine> = {
    "Bœuf": { name: "Pièce de bœuf", quantity: 180, unit: "g" },
    "Veau": { name: "Veau", quantity: 180, unit: "g" },
    "Agneau": { name: "Agneau", quantity: 180, unit: "g" },
    "Canard": { name: "Canard", quantity: 180, unit: "g" },
    "Volaille": { name: "Volaille", quantity: 200, unit: "g" },
    "Cochon": { name: "Cochon", quantity: 180, unit: "g" },
    "Poissons": { name: "Poisson préparé", quantity: 160, unit: "g" },
    "Crustacés": { name: "Crustacés décortiqués", quantity: 150, unit: "g" },
    "Œufs": { name: "Œuf", quantity: 2, unit: "pièce" },
    "Légumes": { name: "Légumes principaux", quantity: 220, unit: "g" },
    "Salades": { name: "Légumes et jeunes pousses", quantity: 180, unit: "g" },
    "Soupes": { name: "Légumes pour potage", quantity: 250, unit: "g" },
    "Charcuterie": { name: "Farce ou charcuterie", quantity: 150, unit: "g" },
    "Abats": { name: "Abats préparés", quantity: 180, unit: "g" },
    "Végétal": { name: "Légumes et légumineuses", quantity: 240, unit: "g" },
    "Chocolat": { name: "Chocolat de couverture", quantity: 70, unit: "g" },
    "Crèmes": { name: "Lait entier", quantity: 150, unit: "ml" },
    "Fruits": { name: "Fruits préparés", quantity: 180, unit: "g" },
    "Pâtisserie": { name: "Appareil pâtissier", quantity: 160, unit: "g" },
  };
  const lines: IngredientLine[] = [primaryByFamily[dish.family] || { name: "Produit principal", quantity: dish.course === "Dessert" ? 160 : 180, unit: "g" }];
  const rules: Array<[string[], IngredientLine]> = [
    [["pomme de terre", "puree", "grenailles", "pommes vapeur", "frites"], { name: "Pommes de terre", quantity: 180, unit: "g" }],
    [["riz"], { name: "Riz sec", quantity: 70, unit: "g" }],
    [["creme", "cremee", "chantilly"], { name: "Crème", quantity: 45, unit: "ml" }],
    [["beurre"], { name: "Beurre", quantity: 20, unit: "g" }],
    [["oeuf", "mimosa", "gribiche"], { name: "Œuf", quantity: 1, unit: "pièce" }],
    [["champignon"], { name: "Champignons", quantity: 70, unit: "g" }],
    [["carotte"], { name: "Carottes", quantity: 80, unit: "g" }],
    [["oignon", "echalote"], { name: "Oignons et échalotes", quantity: 35, unit: "g" }],
    [["vin"], { name: "Vin de cuisson", quantity: 60, unit: "ml" }],
    [["citron"], { name: "Citron", quantity: 0.2, unit: "pièce" }],
    [["moutarde"], { name: "Moutarde", quantity: 12, unit: "g" }],
    [["noisette", "amande", "pistache", "noix"], { name: "Fruits à coque", quantity: 15, unit: "g" }],
    [["pain", "croute", "crouton", "sable"], { name: "Pain ou élément croustillant", quantity: 45, unit: "g" }],
    [["fromage", "chevre", "parmesan"], { name: "Fromage", quantity: 35, unit: "g" }],
  ];
  rules.forEach(([keywords, line]) => {
    if (keywords.some((keyword) => text.includes(keyword))) lines.push(line);
  });
  if (!lines.some((line) => line.name.includes("Herbes"))) lines.push({ name: "Herbes fraîches", quantity: 5, unit: "g" });
  lines.push({ name: "Assaisonnement", quantity: 3, unit: "g" });
  return lines.filter((line, index, array) => array.findIndex((item) => item.name === line.name) === index).slice(0, 8);
}

function buildTechnicalSteps(dish: Dish) {
  const preset = TECHNICAL_RECIPES[dish.id];
  if (preset) return [...preset.steps];
  if (dish.tags.includes("Mijoté")) return ["Peser, tailler et réserver tous les éléments.", "Saisir le produit principal et réaliser la garniture aromatique.", "Mouiller puis mijoter à feu doux jusqu’à texture fondante.", "Refroidir rapidement, portionner et étiqueter.", "Remettre en température, rectifier et dresser à la minute."];
  if (dish.course === "Dessert") return ["Peser précisément tous les ingrédients.", "Réaliser l’appareil ou les préparations de base.", "Cuire ou prendre au froid selon la recette.", "Portionner, dater et conserver à la température adaptée.", "Finir et dresser au moment du service."];
  if (dish.tags.includes("Froid")) return ["Laver, parer et peser les produits.", "Réaliser les cuissons et sauces nécessaires.", "Refroidir rapidement puis portionner.", "Assaisonner et dresser au moment de l’envoi."];
  return ["Parer, peser et organiser la mise en place.", "Préparer la garniture, la sauce et les éléments de finition.", "Cuire le produit principal selon le point défini.", "Portionner les éléments préparés et étiqueter.", "Remettre en température si nécessaire puis dresser."];
}

function migrateLegacyTechnicalSheets(value: Record<string, TechnicalOverride>) {
  const genericNames = new Set(["Produit principal", "Légumes principaux", "Légumes pour potage", "Légumes et légumineuses", "Poisson préparé", "Farce ou charcuterie", "Abats préparés", "Appareil pâtissier", "Assaisonnement"]);
  const genericStep = "Cuire le produit principal selon le point défini.";
  return Object.fromEntries(Object.entries(value).map(([id, sheet]) => {
    const preset = TECHNICAL_RECIPES[id];
    const previousTerrine = id === "e3" && sheet?.steps?.includes("Trancher et servir avec cornichons et pain toasté.");
    const previousBourguignon = id === "p3" && sheet?.ingredients?.some((line) => line.name === "Pommes de terre") && sheet?.steps?.includes("Dégraisser, réduire et rectifier la sauce; servir avec pommes vapeur.");
    const wasGenerated = sheet?.ingredients?.some((line) => genericNames.has(line.name)) || sheet?.steps?.includes(genericStep) || previousTerrine || previousBourguignon;
    return preset && wasGenerated
      ? [id, { ingredients: preset.ingredients.map((line) => ({ ...line })), steps: [...preset.steps] }]
      : [id, sheet];
  }));
}

export default function Home({ userId, userEmail, onSignOut }: HomeProps) {
  const [pilotageMode, setPilotageMode] = useState<"cuisine" | "bar">("cuisine");
  const [query, setQuery] = useState("");
  const [courseFilter, setCourseFilter] = useState<Course | "Tous">("Tous");
  const [openCatalogCourse, setOpenCatalogCourse] = useState<Course | null>("Entrée");
  const [seasonOnly, setSeasonOnly] = useState(true);
  const [vegOnly, setVegOnly] = useState(false);
  const [extraFilters, setExtraFilters] = useState<ExtraFilter[]>([]);
  const [periodType, setPeriodType] = useState<PeriodType>("Mois");
  const [period, setPeriod] = useState("Septembre");
  const [menuTitle, setMenuTitle] = useState("");
  const [targets, setTargets] = useState<Record<Course, number>>({ Entrée: 3, Plat: 5, Dessert: 3 });
  const [selected, setSelected] = useState<string[]>([]);
  const [customDishes, setCustomDishes] = useState<Dish[]>([]);
  const [economicOverrides, setEconomicOverrides] = useState<Record<string, { cost: number; price: number }>>({});
  const [dishContentOverrides, setDishContentOverrides] = useState<Record<string, DishContentOverride>>({});
  const [technicalOverrides, setTechnicalOverrides] = useState<Record<string, TechnicalOverride>>({});
  const [periodSelections, setPeriodSelections] = useState<Record<string, string[]>>({});
  const [savedMenus, setSavedMenus] = useState<SavedMenu[]>([]);
  const [lastSavedCard, setLastSavedCard] = useState<CardSnapshot | null>(null);
  const [newDish, setNewDish] = useState(EMPTY_RECIPE);
  const [detail, setDetail] = useState<Dish | null>(null);
  const [technicalDish, setTechnicalDish] = useState<Dish | null>(null);
  const [technicalPortions, setTechnicalPortions] = useState(10);
  const [magicAnalyzed, setMagicAnalyzed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [productionOpen, setProductionOpen] = useState(false);
  const [shoppingOpen, setShoppingOpen] = useState(false);
  const [covers, setCovers] = useState(60);
  const [buffer, setBuffer] = useState(10);
  const [notice, setNotice] = useState("");
  const [pdfBusy, setPdfBusy] = useState(false);
  const [recipeBookBusy, setRecipeBookBusy] = useState(false);
  const [backupBusy, setBackupBusy] = useState(false);
  const [installOpen, setInstallOpen] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const [standaloneMode, setStandaloneMode] = useState(false);
  const [ready, setReady] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("loading");
  const backupInputRef = useRef<HTMLInputElement>(null);
  const applyingRemoteStateRef = useRef(false);

  useEffect(() => {
    let active = true;
    let unsubscribe: () => void = () => undefined;

    function readLocalPayload(): SharedPayload {
      const storage: Record<string, string> = {};
      APP_STORAGE_KEYS.forEach((key) => {
        const value = window.localStorage.getItem(key);
        if (typeof value === "string") storage[key] = value;
      });
      return { version: 1, storage };
    }

    function storageFromPayload(payload: SharedPayload): Record<string, string> | null {
      const storage = payload.storage;
      if (!storage || typeof storage !== "object" || Array.isArray(storage)) return null;
      return Object.fromEntries(
        Object.entries(storage).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
      );
    }

    function applyPayload(payload: SharedPayload) {
      const storage = storageFromPayload(payload);
      if (storage) {
        APP_STORAGE_KEYS.forEach((key) => {
          const value = storage[key];
          if (typeof value === "string") window.localStorage.setItem(key, value);
          else window.localStorage.removeItem(key);
        });
      }

      const savedPilotageMode = window.localStorage.getItem("auguste-pilotage-mode");
      if (savedPilotageMode === "bar" || savedPilotageMode === "cuisine") setPilotageMode(savedPilotageMode);
      const saved = window.localStorage.getItem("auguste-menu-draft");
      if (saved) {
        try {
          const data = JSON.parse(saved);
          if (Array.isArray(data.selected)) setSelected(data.selected);
          if (data.targets) setTargets(data.targets);
          if (data.period) setPeriod(data.period);
          if (data.periodType) setPeriodType(data.periodType);
          if (data.menuTitle) setMenuTitle(data.menuTitle);
          if (Number.isFinite(data.covers) && data.covers > 0) setCovers(data.covers);
          if ([0, 5, 10, 15, 20].includes(data.buffer)) setBuffer(data.buffer);
        } catch { /* Ignore malformed local data. */ }
      }
      try {
        const lastCard = JSON.parse(window.localStorage.getItem("auguste-last-card") || "null");
        const custom = JSON.parse(window.localStorage.getItem("auguste-custom-recipes") || "[]");
        const archives = JSON.parse(window.localStorage.getItem("auguste-saved-menus") || "[]");
        const economics = JSON.parse(window.localStorage.getItem("auguste-recipe-economics") || "{}");
        const content = JSON.parse(window.localStorage.getItem("auguste-recipe-content") || "{}");
        const technical = JSON.parse(window.localStorage.getItem("auguste-technical-sheets") || "{}");
        const storedPeriodSelections = JSON.parse(window.localStorage.getItem("auguste-period-selections-v1") || "{}");
        if (isCardSnapshot(lastCard)) setLastSavedCard(lastCard);
        if (Array.isArray(custom)) setCustomDishes(custom);
        if (Array.isArray(archives)) setSavedMenus(archives);
        if (economics && typeof economics === "object" && !Array.isArray(economics)) setEconomicOverrides(economics);
        if (content && typeof content === "object" && !Array.isArray(content)) setDishContentOverrides(content);
        if (technical && typeof technical === "object" && !Array.isArray(technical)) setTechnicalOverrides(migrateLegacyTechnicalSheets(technical));
        if (storedPeriodSelections && typeof storedPeriodSelections === "object" && !Array.isArray(storedPeriodSelections)) setPeriodSelections(storedPeriodSelections);
      } catch { /* Ignore malformed local data. */ }
    }

    async function initializeSharedState() {
      const localPayload = readLocalPayload();
      try {
        const remoteRow = await loadSharedState("cuisine");
        if (!active) return;
        const remotePayload = remoteRow && isNonEmptyPayload(remoteRow.payload) && storageFromPayload(remoteRow.payload)
          ? remoteRow.payload
          : null;

        if (remotePayload) {
          applyingRemoteStateRef.current = true;
          applyPayload(remotePayload);
        } else {
          applyPayload(localPayload);
          await saveSharedState("cuisine", localPayload, userId);
        }
        if (!active) return;
        setReady(true);
        setSyncStatus("synced");
        window.requestAnimationFrame(() => { applyingRemoteStateRef.current = false; });

        unsubscribe = subscribeToSharedState("cuisine", (row) => {
          if (!active || row.updated_by === userId || !isNonEmptyPayload(row.payload)) return;
          applyingRemoteStateRef.current = true;
          applyPayload(row.payload);
          setSyncStatus("synced");
          window.requestAnimationFrame(() => { applyingRemoteStateRef.current = false; });
        }, (status) => {
          if (!active) return;
          if (status === "SUBSCRIBED") setSyncStatus("synced");
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") setSyncStatus("offline");
        });
      } catch (error) {
        console.warn("La synchronisation cuisine est momentanément indisponible.", error);
        if (!active) return;
        applyPayload(localPayload);
        setReady(true);
        setSyncStatus("offline");
      }
    }

    void initializeSharedState();
    return () => {
      active = false;
      unsubscribe();
    };
  }, [userId]);

  useEffect(() => {
    const isStandalone = document.documentElement.dataset.augusteStandalone === "true";
    if (isStandalone) {
      const frame = window.requestAnimationFrame(() => {
        setStandaloneMode(true);
        setOfflineReady(true);
      });
      return () => window.cancelAnimationFrame(frame);
    }
    if (!("serviceWorker" in navigator) || !("caches" in window) || window.location.protocol !== "https:") return;

    let cancelled = false;
    const appRoot = new URL("./", window.location.href);
    navigator.serviceWorker.register(new URL("sw.js", appRoot)).then(async () => {
      await navigator.serviceWorker.ready;
      const cache = await window.caches.open(OFFLINE_CACHE_NAME);
      const resources = new Set<string>([
        appRoot.href,
        new URL("manifest.webmanifest", appRoot).href,
        new URL("app-icon-192.png", appRoot).href,
        new URL("app-icon-512.png", appRoot).href,
      ]);
      window.performance.getEntriesByType("resource").forEach((entry) => {
        try {
          const resource = new URL(entry.name);
          if (resource.origin === window.location.origin && resource.protocol.startsWith("http")) resources.add(resource.href);
        } catch { /* Ignore non-URL performance entries. */ }
      });
      await Promise.allSettled([...resources].map((resource) => cache.add(resource)));
      if (!cancelled) setOfflineReady(true);
    }).catch((error) => console.warn("Le mode hors connexion n’a pas pu être préparé.", error));

    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const storage: Record<string, string> = {
      "auguste-menu-draft": JSON.stringify({ selected, targets, period, periodType, menuTitle, covers, buffer }),
      "auguste-last-card": JSON.stringify(lastSavedCard),
      "auguste-custom-recipes": JSON.stringify(customDishes),
      "auguste-saved-menus": JSON.stringify(savedMenus),
      "auguste-recipe-economics": JSON.stringify(economicOverrides),
      "auguste-recipe-content": JSON.stringify(dishContentOverrides),
      "auguste-technical-sheets": JSON.stringify(technicalOverrides),
      "auguste-period-selections-v1": JSON.stringify(periodSelections),
    };
    Object.entries(storage).forEach(([key, value]) => window.localStorage.setItem(key, value));
    if (applyingRemoteStateRef.current) return;

    setSyncStatus("saving");
    const timeout = window.setTimeout(() => {
      void saveSharedState("cuisine", { version: 1, storage }, userId)
        .then(() => setSyncStatus("synced"))
        .catch((error) => {
          console.warn("Les données restent enregistrées sur cet appareil en attendant la connexion.", error);
          setSyncStatus("offline");
        });
    }, 700);
    return () => window.clearTimeout(timeout);
  }, [selected, targets, period, periodType, menuTitle, covers, buffer, customDishes, savedMenus, lastSavedCard, economicOverrides, dishContentOverrides, technicalOverrides, periodSelections, ready, userId]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(""), 2400);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const allDishes = useMemo(() => [...customDishes, ...dishes].map((dish) => ({
    ...dish,
    ...(dishContentOverrides[dish.id] || {}),
    ...(economicOverrides[dish.id] || {}),
  })), [customDishes, dishContentOverrides, economicOverrides]);
  const activeSeason = periodType === "Mois" ? MONTH_TO_SEASON[period] : period;
  const filteredDishes = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("fr");
    return allDishes.filter((dish) => {
      const text = [dish.name, dish.family, dish.description, ...dish.tags].join(" ").toLocaleLowerCase("fr");
      return (!normalized || text.includes(normalized)) &&
        (courseFilter === "Tous" || dish.course === courseFilter) &&
        (!seasonOnly || dish.season.includes("Toute l’année") || dish.season.includes(activeSeason)) &&
        (!vegOnly || getDietProfile(dish) === "Végétarien") &&
        extraFilters.every((filter) => matchesExtraFilter(dish, filter));
    });
  }, [query, courseFilter, seasonOnly, vegOnly, extraFilters, activeSeason, allDishes]);

  const selectedDishes = useMemo(() => selected.map((id) => allDishes.find((dish) => dish.id === id)).filter(Boolean) as Dish[], [selected, allDishes]);
  const countFor = (course: Course) => selectedDishes.filter((dish) => dish.course === course).length;
  const targetTotal = COURSE_ORDER.reduce((total, course) => total + targets[course], 0);
  const averageCost = selectedDishes.length ? selectedDishes.reduce((sum, dish) => sum + dish.cost, 0) / selectedDishes.length : 0;
  const averageMargin = selectedDishes.length ? Math.round(selectedDishes.reduce((sum, dish) => sum + getMargin(dish), 0) / selectedDishes.length) : 0;
  const seasonalScore = selectedDishes.length ? Math.round((selectedDishes.filter((dish) => dish.season.includes("Toute l’année") || dish.season.includes(activeSeason)).length / selectedDishes.length) * 100) : 100;
  const technicalIngredients = technicalDish ? technicalOverrides[technicalDish.id]?.ingredients ?? buildTechnicalIngredients(technicalDish) : [];
  const technicalSteps = technicalDish ? technicalOverrides[technicalDish.id]?.steps ?? buildTechnicalSteps(technicalDish) : [];

  function toggleDish(dish: Dish) {
    if (selected.includes(dish.id)) { setSelected((current) => current.filter((id) => id !== dish.id)); return; }
    if (countFor(dish.course) >= targets[dish.course]) { setNotice(`Quota ${dish.course.toLowerCase()} atteint — augmente-le dans le menu.`); return; }
    setSelected((current) => [...current, dish.id]);
  }

  function toggleExtraFilter(filter: ExtraFilter) {
    setExtraFilters((current) => {
      if (current.includes(filter)) return current.filter((item) => item !== filter);
      if (filter === "Chaud") return [...current.filter((item) => item !== "Froid"), filter];
      if (filter === "Froid") return [...current.filter((item) => item !== "Chaud"), filter];
      return [...current, filter];
    });
  }

  function resetFilters() {
    setQuery("");
    setCourseFilter("Tous");
    setSeasonOnly(false);
    setVegOnly(false);
    setExtraFilters([]);
  }

  function updateDishEconomics(dish: Dish, field: "cost" | "price", rawValue: string) {
    const parsed = Number(rawValue.replace(",", "."));
    if (!Number.isFinite(parsed) || parsed < 0) return;
    setEconomicOverrides((current) => ({
      ...current,
      [dish.id]: {
        cost: current[dish.id]?.cost ?? dish.cost,
        price: current[dish.id]?.price ?? dish.price,
        [field]: parsed,
      },
    }));
  }

  function setCourseTarget(course: Course, requestedValue: number) {
    if (!Number.isFinite(requestedValue)) return targets[course];
    const nextValue = Math.min(12, Math.max(1, Math.round(requestedValue)));
    const selectedInCourse = selectedDishes.filter((dish) => dish.course === course).map((dish) => dish.id);
    const overflow = Math.max(0, selectedInCourse.length - nextValue);
    if (overflow) {
      const removedIds = new Set(selectedInCourse.slice(-overflow));
      setSelected((current) => current.filter((id) => !removedIds.has(id)));
      setNotice(`${overflow} recette${overflow > 1 ? "s" : ""} retirée${overflow > 1 ? "s" : ""} pour respecter le nouveau quota.`);
    }
    setTargets((current) => ({ ...current, [course]: nextValue }));
    return nextValue;
  }

  function changeTarget(course: Course, amount: number) {
    setCourseTarget(course, targets[course] + amount);
  }

  function buildSuggestedSelection(nextPeriodType: PeriodType, nextPeriod: string) {
    const nextSeason = nextPeriodType === "Mois" ? MONTH_TO_SEASON[nextPeriod] : nextPeriod;
    const nextKey = periodStorageKey(nextPeriodType, nextPeriod);
    return COURSE_ORDER.flatMap((course) => allDishes
      .filter((dish) => dish.course === course && (dish.season.includes("Toute l’année") || dish.season.includes(nextSeason)))
      .sort((a, b) => {
        const aSeasonal = Number(a.season.includes(nextSeason) && !a.season.includes("Toute l’année"));
        const bSeasonal = Number(b.season.includes(nextSeason) && !b.season.includes("Toute l’année"));
        return bSeasonal - aSeasonal
          || Number(Boolean(b.signature)) - Number(Boolean(a.signature))
          || stablePeriodRank(`${nextKey}:${a.id}`) - stablePeriodRank(`${nextKey}:${b.id}`);
      })
      .slice(0, targets[course])
      .map((dish) => dish.id));
  }

  function sanitizePeriodSelection(selection: string[]) {
    return COURSE_ORDER.flatMap((course) => selection
      .filter((id) => allDishes.find((dish) => dish.id === id)?.course === course)
      .slice(0, targets[course]));
  }

  function changePeriod(nextPeriodType: PeriodType, nextPeriod: string) {
    if (nextPeriodType === periodType && nextPeriod === period) return;
    const currentKey = periodStorageKey(periodType, period);
    const nextKey = periodStorageKey(nextPeriodType, nextPeriod);
    const updatedPeriodSelections = { ...periodSelections, [currentKey]: selected };
    const hasSavedSelection = Object.prototype.hasOwnProperty.call(updatedPeriodSelections, nextKey);
    const nextSelection = hasSavedSelection
      ? sanitizePeriodSelection(updatedPeriodSelections[nextKey] || [])
      : buildSuggestedSelection(nextPeriodType, nextPeriod);

    setPeriodSelections(updatedPeriodSelections);
    setPeriodType(nextPeriodType);
    setPeriod(nextPeriod);
    setSelected(nextSelection);
    setMenuTitle(`Carte de ${nextPeriod.toLowerCase()}`);
    setSeasonOnly(true);
    setQuery("");
    setNotice(hasSavedSelection ? `Carte de ${nextPeriod.toLowerCase()} restaurée.` : `Nouvelle carte de ${nextPeriod.toLowerCase()} proposée selon la saison.`);
  }

  function changePeriodType(nextPeriodType: PeriodType) {
    if (nextPeriodType === periodType) return;
    const nextPeriod = nextPeriodType === "Saison" ? activeSeason : SEASON_TO_MONTH[period] || "Septembre";
    changePeriod(nextPeriodType, nextPeriod);
  }

  function completeAutomatically() {
    const next = [...selected];
    COURSE_ORDER.forEach((course) => {
      const already = next.filter((id) => allDishes.find((dish) => dish.id === id)?.course === course).length;
      const candidates = allDishes.filter((dish) => dish.course === course && !next.includes(dish.id) && (dish.season.includes("Toute l’année") || dish.season.includes(activeSeason)))
        .sort((a, b) => Number(Boolean(b.signature)) - Number(Boolean(a.signature)) || getMargin(b) - getMargin(a));
      next.push(...candidates.slice(0, Math.max(0, targets[course] - already)).map((dish) => dish.id));
    });
    setSelected(next);
    setNotice("Menu complété avec les meilleures options de saison.");
  }

  const isComplete = COURSE_ORDER.every((course) => countFor(course) === targets[course]);
  const balanceScore = Math.min(100, Math.round((selected.length / targetTotal) * 60 + seasonalScore * 0.4));
  const shoppingPlan = useMemo<ShoppingPlanLine[]>(() => COURSE_ORDER.flatMap((course) => {
    const items = selectedDishes.filter((dish) => dish.course === course);
    if (!items.length) return [];
    const portions = Math.ceil((covers / items.length) * (1 + buffer / 100));
    return items.map((dish) => ({ dish, portions }));
  }), [selectedDishes, covers, buffer]);
  const shoppingList = useMemo<ShoppingLine[]>(() => {
    const grouped = new Map<string, ShoppingLine>();
    shoppingPlan.forEach(({ dish, portions }) => {
      const ingredients = technicalOverrides[dish.id]?.ingredients ?? buildTechnicalIngredients(dish);
      ingredients.forEach((ingredient) => {
        const name = ingredient.name.trim();
        if (!name || ingredient.quantity <= 0) return;
        const key = `${normalizedText(name)}::${ingredient.unit}`;
        const existing = grouped.get(key);
        const quantity = ingredient.quantity * portions;
        if (existing) existing.quantity += quantity;
        else grouped.set(key, { name, quantity, unit: ingredient.unit });
      });
    });
    return [...grouped.values()].sort((a, b) => a.name.localeCompare(b.name, "fr", { sensitivity: "base" }));
  }, [shoppingPlan, technicalOverrides]);
  const shoppingBudget = shoppingPlan.reduce((total, item) => total + item.dish.cost * item.portions, 0);
  const averagePlateCost = COURSE_ORDER.reduce((total, course) => {
    const items = selectedDishes.filter((dish) => dish.course === course);
    return total + (items.length ? items.reduce((sum, dish) => sum + dish.cost, 0) / items.length : 0);
  }, 0);
  const projectedFoodCost = shoppingBudget;
  const menuChecks = [
    { ok: seasonalScore >= 85, label: "Produits cohérents avec la saison" },
    { ok: !selected.length || averageMargin >= 70, label: "Marge moyenne supérieure à 70 %" },
    { ok: selectedDishes.some((dish) => dish.course === "Plat" && getDietProfile(dish) === "Végétarien"), label: "Au moins un plat végétarien" },
    { ok: selectedDishes.some((dish) => dish.course === "Plat" && getDietProfile(dish) === "Poisson"), label: "Une proposition poisson" },
  ];

  function saveMenu() {
    if (!selected.length) { setNotice("Ajoutez au moins une recette avant d’archiver."); return; }
    const archive: SavedMenu = {
      id: `menu-${Date.now()}`,
      title: menuTitle.trim() || `Carte de ${period.toLowerCase()}`,
      period,
      periodType,
      selected: [...selected],
      targets: { ...targets },
      createdAt: new Date().toISOString(),
    };
    setSavedMenus((current) => [archive, ...current].slice(0, 30));
    setNotice("Menu archivé — vous pourrez le reprendre plus tard.");
    setMobileMenuOpen(false);
  }

  function currentCardSnapshot(): CardSnapshot {
    return {
      title: menuTitle,
      period,
      periodType,
      selected: [...selected],
      targets: { ...targets },
      covers,
      buffer,
      savedAt: new Date().toISOString(),
    };
  }

  function saveCurrentCard() {
    if (!selected.length) { setNotice("Ajoutez au moins une recette avant de sauvegarder la carte."); return; }
    const snapshot = currentCardSnapshot();
    window.localStorage.setItem("auguste-last-card", JSON.stringify(snapshot));
    setLastSavedCard(snapshot);
    setNotice("Carte sauvegardée — vous pouvez continuer à la modifier.");
  }

  function restoreLastSavedCard() {
    if (!lastSavedCard) { setNotice("Aucune carte sauvegardée pour le moment."); return; }
    const current = currentCardSnapshot();
    const currentComparable = { ...current, savedAt: "" };
    const savedComparable = { ...lastSavedCard, savedAt: "" };
    if (JSON.stringify(currentComparable) !== JSON.stringify(savedComparable)) {
      const confirmed = window.confirm(
        "Revenir à la dernière carte sauvegardée ?\n\nLa sélection actuellement affichée sera remplacée.",
      );
      if (!confirmed) return;
    }
    setSelected([...lastSavedCard.selected]);
    setTargets({ ...lastSavedCard.targets });
    setPeriod(lastSavedCard.period);
    setPeriodType(lastSavedCard.periodType);
    setMenuTitle(lastSavedCard.title);
    setCovers(lastSavedCard.covers || 60);
    setBuffer([0, 5, 10, 15, 20].includes(lastSavedCard.buffer) ? lastSavedCard.buffer : 10);
    setNotice("Dernière carte sauvegardée restaurée.");
  }

  function loadMenu(menu: SavedMenu) {
    setSelected(menu.selected);
    setTargets(menu.targets);
    setPeriod(menu.period);
    setPeriodType(menu.periodType);
    setMenuTitle(menu.title);
    setArchiveOpen(false);
    setNotice(`${menu.title} chargé dans l’éditeur.`);
  }

  function openTechnicalSheet(dish: Dish) {
    setDetail(null);
    setTechnicalDish(dish);
    setTechnicalPortions(10);
    setTechnicalOverrides((current) => current[dish.id] ? current : { ...current, [dish.id]: { ingredients: buildTechnicalIngredients(dish), steps: buildTechnicalSteps(dish) } });
  }

  function updateTechnicalDishField(field: "name" | "course" | "description" | "prep" | "allergens", value: string | number | string[]) {
    if (!technicalDish) return;
    setTechnicalDish((current) => current ? ({ ...current, [field]: value } as Dish) : current);
    setDishContentOverrides((current) => ({ ...current, [technicalDish.id]: { ...current[technicalDish.id], [field]: value } }));
  }

  function updateTechnicalCost(rawValue: string) {
    if (!technicalDish) return;
    const cost = Number(rawValue.replace(",", "."));
    if (!Number.isFinite(cost) || cost < 0) return;
    setTechnicalDish((current) => current ? { ...current, cost } : current);
    setEconomicOverrides((current) => ({ ...current, [technicalDish.id]: { cost, price: current[technicalDish.id]?.price ?? technicalDish.price } }));
  }

  function updateIngredient(index: number, change: Partial<IngredientLine>) {
    if (!technicalDish) return;
    setTechnicalOverrides((current) => {
      const sheet = current[technicalDish.id] ?? { ingredients: buildTechnicalIngredients(technicalDish), steps: buildTechnicalSteps(technicalDish) };
      return { ...current, [technicalDish.id]: { ...sheet, ingredients: sheet.ingredients.map((item, itemIndex) => itemIndex === index ? { ...item, ...change } : item) } };
    });
  }

  function addIngredient() {
    if (!technicalDish) return;
    setTechnicalOverrides((current) => {
      const sheet = current[technicalDish.id] ?? { ingredients: buildTechnicalIngredients(technicalDish), steps: buildTechnicalSteps(technicalDish) };
      return { ...current, [technicalDish.id]: { ...sheet, ingredients: [...sheet.ingredients, { name: "Nouvel ingrédient", quantity: 0, unit: "g" }] } };
    });
  }

  function removeIngredient(index: number) {
    if (!technicalDish) return;
    setTechnicalOverrides((current) => {
      const sheet = current[technicalDish.id];
      if (!sheet) return current;
      return { ...current, [technicalDish.id]: { ...sheet, ingredients: sheet.ingredients.filter((_, itemIndex) => itemIndex !== index) } };
    });
  }

  function updateStep(index: number, value: string) {
    if (!technicalDish) return;
    setTechnicalOverrides((current) => {
      const sheet = current[technicalDish.id] ?? { ingredients: buildTechnicalIngredients(technicalDish), steps: buildTechnicalSteps(technicalDish) };
      return { ...current, [technicalDish.id]: { ...sheet, steps: sheet.steps.map((step, stepIndex) => stepIndex === index ? value : step) } };
    });
  }

  function addStep() {
    if (!technicalDish) return;
    setTechnicalOverrides((current) => {
      const sheet = current[technicalDish.id] ?? { ingredients: buildTechnicalIngredients(technicalDish), steps: buildTechnicalSteps(technicalDish) };
      return { ...current, [technicalDish.id]: { ...sheet, steps: [...sheet.steps, "Nouvelle étape de préparation."] } };
    });
  }

  function removeStep(index: number) {
    if (!technicalDish) return;
    setTechnicalOverrides((current) => {
      const sheet = current[technicalDish.id];
      if (!sheet) return current;
      return { ...current, [technicalDish.id]: { ...sheet, steps: sheet.steps.filter((_, stepIndex) => stepIndex !== index) } };
    });
  }

  function runMagicClassification() {
    if (newDish.name.trim().length < 3) { setNotice("Saisissez d’abord l’intitulé de la recette."); return; }
    setNewDish(classifyRecipeTitle(newDish.name));
    setMagicAnalyzed(true);
    setNotice("Classement proposé — vérifiez puis validez.");
  }

  function createRecipe(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cost = Number(newDish.cost.replace(",", "."));
    const price = Number(newDish.price.replace(",", "."));
    if (!newDish.name.trim() || !newDish.family.trim() || !cost || !price) { setNotice("Complétez le nom, la famille, le coût et le prix."); return; }
    const created: Dish = {
      id: `custom-${Date.now()}`,
      name: newDish.name.trim(),
      course: newDish.course,
      family: newDish.family.trim(),
      description: newDish.description.trim() || "Recette maison à documenter.",
      season: [newDish.season],
      cost,
      price,
      prep: Math.max(1, Number(newDish.prep) || 30),
      difficulty: 2,
      vegetarian: newDish.dietProfile === "Végétarien",
      dietProfile: newDish.dietProfile,
      allergens: newDish.allergens.split(",").map((item) => item.trim()).filter(Boolean),
      tags: ["Création maison"],
    };
    setCustomDishes((current) => [created, ...current]);
    setNewDish(EMPTY_RECIPE);
    setMagicAnalyzed(false);
    setCreateOpen(false);
    setSeasonOnly(false);
    setCourseFilter(created.course);
    setDetail(created);
    setNotice("Nouvelle recette ajoutée à la carte maître.");
  }

  function exportMenu() {
    if (!selectedDishes.length) { setNotice("Le menu est encore vide."); return; }
    const rows = [["Type", "Recette", "Famille", "Coût portion", "Prix carte", "Marge", "Allergènes"], ...selectedDishes.map((dish) => [dish.course, dish.name, dish.family, dish.cost.toFixed(2), dish.price.toFixed(2), `${getMargin(dish)}%`, dish.allergens.join(" / ")])];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `menu-auguste-${period.toLowerCase()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function downloadApplicationBackup() {
    setBackupBusy(true);
    try {
      const storage: Record<string, string> = {
        "auguste-menu-draft": JSON.stringify({ selected, targets, period, periodType, menuTitle, covers, buffer }),
        "auguste-last-card": JSON.stringify(lastSavedCard),
        "auguste-custom-recipes": JSON.stringify(customDishes),
        "auguste-saved-menus": JSON.stringify(savedMenus),
        "auguste-recipe-economics": JSON.stringify(economicOverrides),
        "auguste-recipe-content": JSON.stringify(dishContentOverrides),
        "auguste-technical-sheets": JSON.stringify(technicalOverrides),
        "auguste-period-selections-v1": JSON.stringify(periodSelections),
      };
      const payload = {
        version: 1,
        backupId: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        createdAt: new Date().toISOString(),
        storage,
      };

      let html: string;
      if (document.documentElement.dataset.augusteStandalone === "true") {
        const clone = document.documentElement.cloneNode(true) as HTMLElement;
        clone.querySelector("#root")?.replaceChildren();
        clone.querySelectorAll('script[src], link[rel="stylesheet"][href]').forEach((element) => element.remove());
        const backupNode = clone.querySelector<HTMLScriptElement>(`#${BACKUP_DATA_ELEMENT_ID}`);
        if (!backupNode) throw new Error("Le point de sauvegarde est absent du document autonome.");
        backupNode.textContent = safeJsonForHtml(payload);
        html = `<!doctype html>\n${clone.outerHTML}`;
      } else {
        const response = await fetch("/chez-auguste-autonome.html", { cache: "no-store" });
        if (!response.ok) throw new Error("Le fichier autonome n’est pas disponible.");
        html = addBackupDataToHtml(await response.text(), payload);
      }

      const date = new Intl.DateTimeFormat("fr-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
      const saveResult = await downloadHtmlFile(html, `Chez-Auguste-sauvegarde-${date}.html`);
      if (saveResult === "cancelled") return;
      setMobileMenuOpen(false);
      setNotice(saveResult === "shared" ? "Sauvegarde prête — choisissez « Enregistrer dans Fichiers »." : "Sauvegarde HTML créée avec toutes les données de cet appareil.");
    } catch (error) {
      console.error(error);
      setNotice("La sauvegarde HTML n’a pas pu être créée. Réessayez dans un instant.");
    } finally {
      setBackupBusy(false);
    }
  }

  async function importApplicationBackup(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    try {
      const html = await file.text();
      const backupDocument = new DOMParser().parseFromString(html, "text/html");
      const backupNode = backupDocument.getElementById(BACKUP_DATA_ELEMENT_ID);
      if (!backupNode) throw new Error("Ce fichier ne contient pas de sauvegarde Chez Auguste.");
      const payload = JSON.parse(backupNode.textContent || "{}");
      const storage = payload?.storage;
      if (!storage || typeof storage !== "object" || !APP_STORAGE_KEYS.some((key) => typeof storage[key] === "string")) {
        throw new Error("Cette sauvegarde ne contient aucune donnée restaurable.");
      }
      const confirmed = window.confirm(
        "Importer cette sauvegarde ?\n\nLes recettes, fiches techniques, menus archivés et la sélection actuels seront remplacés par ceux du fichier.",
      );
      if (!confirmed) return;
      APP_STORAGE_KEYS.forEach((key) => {
        const value = storage[key];
        if (typeof value === "string") window.localStorage.setItem(key, value);
        else window.localStorage.removeItem(key);
      });
      window.location.reload();
    } catch (error) {
      console.error(error);
      setNotice(error instanceof Error ? error.message : "Cette sauvegarde n’a pas pu être importée.");
    }
  }

  function restoreOriginalData() {
    const confirmed = window.confirm(
      "Restaurer les données d’origine ?\n\nCette action effacera les recettes ajoutées, les modifications des fiches techniques, les menus archivés, la dernière carte sauvegardée et la sélection actuelle sur cet appareil.",
    );
    if (!confirmed) return;
    APP_STORAGE_KEYS.forEach((key) => window.localStorage.removeItem(key));
    window.location.reload();
  }

  async function downloadCurrentMenuPdf() {
    if (!selectedDishes.length) { setNotice("Sélectionnez au moins une recette avant de télécharger la carte."); return; }
    setPdfBusy(true);
    try {
      const { downloadMenuPdf } = await import("./menu-pdf.mjs");
      const logoDataUrl = await loadImageAsDataUrl(BRAND_LOGO_SRC);
      downloadMenuPdf({
        menuTitle: menuTitle.trim() || `Carte de ${period.toLowerCase()}`,
        period: periodType === "Mois" ? `Menu du mois · ${period}` : `Menu de saison · ${period}`,
        dishes: selectedDishes.map((dish) => ({
          course: dish.course,
          name: dish.name,
          description: dish.description,
          price: dish.price,
          vegetarian: getDietProfile(dish) === "Végétarien",
        })),
        logoDataUrl,
      });
      setMobileMenuOpen(false);
      setNotice("La carte PDF élégante est téléchargée.");
    } catch (error) {
      console.error(error);
      setNotice("Le PDF n’a pas pu être généré. Réessayez dans un instant.");
    } finally {
      setPdfBusy(false);
    }
  }

  async function downloadRecipeBook() {
    if (!allDishes.length) { setNotice("Ajoutez au moins une recette avant de télécharger le livre."); return; }
    setRecipeBookBusy(true);
    try {
      const { downloadRecipeBookPdf } = await import("./menu-pdf.mjs");
      const logoDataUrl = await loadImageAsDataUrl(BRAND_LOGO_SRC);
      downloadRecipeBookPdf({
        portions: 10,
        logoDataUrl,
        recipes: allDishes.map((dish) => ({
          course: dish.course,
          family: dish.family,
          name: dish.name,
          description: dish.description,
          cost: dish.cost,
          price: dish.price,
          prep: dish.prep,
          allergens: dish.allergens,
          ingredients: technicalOverrides[dish.id]?.ingredients ?? buildTechnicalIngredients(dish),
          steps: technicalOverrides[dish.id]?.steps ?? buildTechnicalSteps(dish),
        })),
      });
      setNotice(`Le livre de ${allDishes.length} recettes est téléchargé.`);
    } catch (error) {
      console.error(error);
      setNotice("Le livre de recettes n’a pas pu être généré. Réessayez dans un instant.");
    } finally {
      setRecipeBookBusy(false);
    }
  }

  function printCurrentMenu() {
    if (!selectedDishes.length) { setNotice("Sélectionnez au moins une recette avant d’imprimer la carte."); return; }
    const title = escapePrintText(menuTitle.trim() || `Carte de ${period.toLowerCase()}`);
    const periodLabel = escapePrintText(periodType === "Mois" ? `Menu du mois · ${period}` : `Menu de saison · ${period}`);
    const sections = COURSE_ORDER.map((course, sectionIndex) => {
      const items = selectedDishes.filter((dish) => dish.course === course);
      if (!items.length) return "";
      const rows = items.map((dish) => `
        <article class="dish">
          <div>
            <strong>${escapePrintText(dish.name)}${getDietProfile(dish) === "Végétarien" ? ' <span class="vegetarian">V</span>' : ""}</strong>
            <p>${escapePrintText(dish.description)}</p>
          </div>
          <b>${escapePrintText(euro.format(dish.price))}</b>
        </article>`).join("");
      return `<section><h2><em>${String(sectionIndex + 1).padStart(2, "0")}</em><span>${escapePrintText(`${course}s`)}</span><i></i></h2>${rows}</section>`;
    }).join("");
    const printWindow = window.open("", "auguste-menu-print", "width=900,height=850");
    if (!printWindow) { setNotice("Autorisez l’ouverture de la fenêtre d’impression, puis réessayez."); return; }
    printWindow.document.open();
    printWindow.document.write(`<!doctype html>
      <html lang="fr"><head><meta charset="utf-8"><title>${title} — Chez Auguste</title>
      <style>
        @page { size: A4 portrait; margin: 0; }
        * { box-sizing: border-box; }
        body { margin: 0; background: #fcfaf7; color: #201c1a; font-family: "Helvetica Neue", Arial, sans-serif; }
        .page { width: 210mm; min-height: 297mm; margin: 0 auto; padding: 14mm 22mm 11mm; position: relative; }
        header { text-align: center; margin-bottom: 9mm; }
        .print-logo { display: block; width: 44mm; height: 32mm; margin: 0 auto 1.5mm; object-fit: contain; }
        .kicker { margin: 0 0 2.6mm; color: #881f2a; font-size: 2.2mm; font-weight: 750; letter-spacing: .28em; text-transform: uppercase; }
        .menu-title { margin: 0; color: #201c1a; font-size: 6mm; line-height: 1.05; font-weight: 700; }
        .period { margin: 2.5mm 0 0; color: #706861; font-size: 2.25mm; letter-spacing: .16em; text-transform: uppercase; }
        header::after { content: ""; display: block; width: 18mm; height: .4mm; margin: 4mm auto 0; background: #b28b5c; }
        section { margin: 0 0 8mm; }
        h2 { margin: 0 0 3.5mm; display: grid; grid-template-columns: 8mm auto 1fr; align-items: center; gap: 4mm; text-transform: uppercase; }
        h2 em { color: #b28b5c; font-size: 2.2mm; font-style: normal; font-weight: 500; }
        h2 span { color: #881f2a; font-size: 2.65mm; font-weight: 750; letter-spacing: .2em; }
        h2 i { height: .2mm; background: #e1d9cf; }
        .dish { min-height: 12mm; padding: 1.5mm 0 2.8mm 12mm; display: grid; grid-template-columns: 1fr auto; gap: 8mm; align-items: start; break-inside: avoid; }
        .dish strong { font-size: 3.45mm; line-height: 1.15; font-weight: 700; }
        .dish p { margin: 1.05mm 0 0; color: #706861; font-size: 2.45mm; line-height: 1.35; }
        .dish b { color: #201c1a; font-size: 2.9mm; font-weight: 500; white-space: nowrap; }
        .vegetarian { display: inline-grid; width: 4mm; height: 4mm; margin-left: 1mm; border: .25mm solid #718265; border-radius: 50%; place-items: center; color: #58704d; font-size: 2mm; vertical-align: .5mm; }
        footer { margin-top: 6mm; padding-top: 3mm; border-top: .2mm solid #e1d9cf; color: #706861; text-align: center; font-size: 1.9mm; letter-spacing: .12em; text-transform: uppercase; }
        @media screen { body { padding: 20px; } .page { box-shadow: 0 24px 70px rgba(32,20,15,.18); } }
      </style></head><body><div class="page"><header><img class="print-logo" src="${BRAND_LOGO_SRC}" alt="Chez Auguste — Bouillon Brasserie"><p class="kicker">La carte</p><p class="menu-title">${title}</p><p class="period">${periodLabel}</p></header><main>${sections}</main><footer>Cuisine française · Produits de saison · Fait maison</footer></div></body></html>`);
    printWindow.document.close();
    printWindow.focus();
    window.setTimeout(() => printWindow.print(), 250);
    setNotice("La carte est prête à être imprimée.");
  }

  function printShoppingList() {
    if (!shoppingList.length) { setNotice("Sélectionnez des recettes avant de préparer les courses."); return; }
    const title = escapePrintText(menuTitle.trim() || `Carte de ${period.toLowerCase()}`);
    const listRows = shoppingList.map((item) => `<div class="shopping-row"><span class="check"></span><strong>${escapePrintText(item.name)}</strong><b>${escapePrintText(formatShoppingQuantity(item))}</b></div>`).join("");
    const planRows = COURSE_ORDER.map((course) => {
      const items = shoppingPlan.filter((item) => item.dish.course === course);
      if (!items.length) return "";
      return `<section><h3>${escapePrintText(`${course}s`)}</h3>${items.map((item) => `<p><span>${escapePrintText(item.dish.name)}</span><b>${item.portions} portions</b></p>`).join("")}</section>`;
    }).join("");
    const printWindow = window.open("", "auguste-shopping-print", "width=900,height=850");
    if (!printWindow) { setNotice("Autorisez l’ouverture de la fenêtre d’impression, puis réessayez."); return; }
    printWindow.document.open();
    printWindow.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Liste de courses — ${title}</title><style>
      @page { size: A4 portrait; margin: 12mm; } * { box-sizing: border-box; } body { margin: 0; color: #201c1a; font-family: "Helvetica Neue", Arial, sans-serif; }
      header { display: grid; grid-template-columns: 37mm 1fr; gap: 9mm; align-items: center; padding-bottom: 7mm; border-bottom: .35mm solid #881f2a; }
      .logo { width: 37mm; height: 27mm; object-fit: contain; } .eyebrow { margin: 0 0 2mm; color: #881f2a; font-size: 2.2mm; font-weight: 800; letter-spacing: .2em; text-transform: uppercase; }
      h1 { margin: 0; font-size: 7mm; letter-spacing: -.03em; } .subtitle { margin: 2mm 0 0; color: #706861; font-size: 2.5mm; }
      .kpis { margin: 7mm 0; display: grid; grid-template-columns: repeat(3, 1fr); border: .25mm solid #ded5ca; border-radius: 2mm; overflow: hidden; }
      .kpis div { min-height: 18mm; padding: 3.5mm; border-right: .25mm solid #ded5ca; display: grid; align-content: center; gap: 1.5mm; } .kpis div:last-child { border: 0; }
      .kpis span { color: #706861; font-size: 2.1mm; text-transform: uppercase; letter-spacing: .08em; } .kpis strong { font-size: 4.2mm; }
      h2 { margin: 0 0 3mm; color: #881f2a; font-size: 3mm; letter-spacing: .16em; text-transform: uppercase; }
      .shopping-list { columns: 2; column-gap: 9mm; } .shopping-row { min-height: 9mm; padding: 2mm 0; border-bottom: .2mm solid #ebe5dc; display: grid; grid-template-columns: 5mm 1fr auto; gap: 2.5mm; align-items: center; break-inside: avoid; }
      .check { width: 3.6mm; height: 3.6mm; border: .3mm solid #b9aea1; border-radius: .5mm; } .shopping-row strong { font-size: 2.7mm; } .shopping-row b { font-size: 2.6mm; font-weight: 600; }
      .plan { margin-top: 9mm; padding-top: 5mm; border-top: .25mm solid #ded5ca; display: grid; grid-template-columns: repeat(3, 1fr); gap: 6mm; } .plan section { break-inside: avoid; }
      .plan h3 { margin: 0 0 2mm; color: #881f2a; font-size: 2.5mm; text-transform: uppercase; letter-spacing: .12em; } .plan p { margin: 0; padding: 1.3mm 0; display: flex; justify-content: space-between; gap: 3mm; font-size: 2.2mm; } .plan p b { white-space: nowrap; }
      footer { margin-top: 8mm; padding-top: 3mm; border-top: .2mm solid #ded5ca; color: #706861; font-size: 2mm; line-height: 1.4; }
    </style></head><body><header><img class="logo" src="${BRAND_LOGO_SRC}" alt="Chez Auguste"><div><p class="eyebrow">Organisation cuisine</p><h1>Liste de courses</h1><p class="subtitle">${title}</p></div></header><div class="kpis"><div><span>Couverts</span><strong>${covers}</strong></div><div><span>Sécurité</span><strong>+${buffer} %</strong></div><div><span>Budget estimé</span><strong>${escapePrintText(euro.format(shoppingBudget))}</strong></div></div><h2>Produits à commander</h2><main class="shopping-list">${listRows}</main><div class="plan">${planRows}</div><footer>Estimation calculée depuis les fiches techniques et les coûts par portion. Vérifiez les conditionnements et les tarifs fournisseurs avant commande.</footer></body></html>`);
    printWindow.document.close();
    printWindow.focus();
    window.setTimeout(() => printWindow.print(), 250);
    setNotice("La liste de courses est prête à être imprimée.");
  }

  function focusMenuComposer() {
    if (window.innerWidth <= 880) {
      setMobileMenuOpen(true);
      return;
    }
    document.getElementById("menu-composer")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function switchPilotage(mode: "cuisine" | "bar") {
    setPilotageMode(mode);
    window.localStorage.setItem("auguste-pilotage-mode", mode);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-lockup"><img className="brand-logo" src={BRAND_LOGO_SRC} alt="Chez Auguste — Bouillon Brasserie" /><div className="brand-context"><h1>Carnet de cuisine</h1><span>Carte, coûts & production</span></div></div>
        <nav className="pilotage-switcher" aria-label="Choisir l’espace de pilotage">
          <button type="button" className={pilotageMode === "cuisine" ? "active" : ""} onClick={() => switchPilotage("cuisine")}><span>01</span><strong>Pilotage cuisine</strong></button>
          <button type="button" className={pilotageMode === "bar" ? "active" : ""} onClick={() => switchPilotage("bar")}><span>02</span><strong>Pilotage bar</strong></button>
        </nav>
        {pilotageMode === "cuisine" && <div className="topbar-actions">
          <span className={`autosave ${syncStatus}`}><i /> {syncStatus === "loading" ? "Connexion…" : syncStatus === "saving" ? "Sauvegarde…" : syncStatus === "synced" ? "Synchronisé en direct" : "Hors ligne — sauvegardé ici"}</span>
          <details className="topbar-tools"><summary>Outils</summary><div><button type="button" onClick={() => setArchiveOpen(true)}>Menus archivés <span>{savedMenus.length}</span></button><button type="button" onClick={printCurrentMenu} disabled={!selectedDishes.length}>Imprimer la carte</button><button type="button" onClick={() => setProductionOpen(true)}>Plan de production</button><button type="button" onClick={() => setShoppingOpen(true)} disabled={!selectedDishes.length}>Courses & budget</button></div></details>
          <button className="save-card-top-button" type="button" onClick={saveCurrentCard} disabled={!selected.length}>✓ Sauvegarder la carte</button>
          <button className="download-card-button" type="button" onClick={downloadCurrentMenuPdf} disabled={pdfBusy || !selectedDishes.length}>{pdfBusy ? "Création du PDF…" : "↓ Télécharger la carte"}</button>
          <button className="primary-button" type="button" onClick={focusMenuComposer}>Composer le menu <span>{selected.length}/{targetTotal}</span></button>
        </div>}
        <button className="account-button" type="button" title={userEmail} onClick={onSignOut}>Déconnexion</button>
      </header>

      {pilotageMode === "bar" ? <BarPilotage userId={userId} /> : <>
      <section className="period-bar">
        <div className="period-intro"><p className="eyebrow">Menu en préparation</p><strong>{periodType === "Mois" ? `Carte de ${period.toLowerCase()}` : `Carte ${period.toLowerCase()}`}</strong></div>
        <div className="period-controls">
          <div className="segmented" aria-label="Type de période">
            {(["Mois", "Saison"] as PeriodType[]).map((type) => <button type="button" className={periodType === type ? "active" : ""} onClick={() => changePeriodType(type)} key={type}>{type}</button>)}
          </div>
          <select value={period} onChange={(event) => changePeriod(periodType, event.target.value)} aria-label="Période du menu">{(periodType === "Mois" ? MONTHS : SEASONS).map((item) => <option key={item}>{item}</option>)}</select>
        </div>
        <div className="quick-stats">
          <div><span>Recettes</span><strong>{selected.length}<small> / {targetTotal}</small></strong></div>
          <div><span>Coût moyen</span><strong>{euro.format(averageCost)}</strong></div>
          <div><span>Marge moyenne</span><strong>{averageMargin || "—"}{averageMargin ? "%" : ""}</strong></div>
          <div><span>De saison</span><strong>{seasonalScore}%</strong></div>
        </div>
      </section>

      <div className="workspace">
        <section className="catalog-panel">
          <div className="catalog-heading">
            <div><p className="eyebrow">Carte maître · {allDishes.length} recettes</p><h2>Choisissez les recettes</h2><p>Cliquez sur une fiche pour l’ajouter au menu. Tout reste modifiable.</p></div>
            <div className="catalog-actions"><button className="secondary-button magic-add-button" type="button" onClick={() => { setNewDish(EMPTY_RECIPE); setMagicAnalyzed(false); setCreateOpen(true); }}>✦ Ajouter un produit carte</button><button className="magic-button" type="button" onClick={completeAutomatically}>✦ Compléter intelligemment</button></div>
          </div>
          <div className="filters">
            <label className="search-field"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher une recette, un produit…" />{query && <button type="button" onClick={() => setQuery("")} aria-label="Effacer la recherche">×</button>}</label>
            <div className="filter-controls">
              <div className="filter-heading"><div><strong>Filtres</strong><span>{Number(seasonOnly) + Number(vegOnly) + extraFilters.length ? `${Number(seasonOnly) + Number(vegOnly) + extraFilters.length} actif${Number(seasonOnly) + Number(vegOnly) + extraFilters.length > 1 ? "s" : ""}` : "Affinez la carte"}</span></div><button type="button" className="clear-filters-button" onClick={resetFilters} disabled={!query && courseFilter === "Tous" && !seasonOnly && !vegOnly && extraFilters.length === 0}>× Effacer les filtres</button></div>
              <div className="course-tabs" role="tablist" aria-label="Catégories de recettes">
                {(["Tous", ...COURSE_ORDER] as const).map((course) => <button type="button" className={courseFilter === course ? "active" : ""} onClick={() => setCourseFilter(course)} key={course}>{course}{course !== "Tous" && <span>{allDishes.filter((dish) => dish.course === course).length}</span>}</button>)}
              </div>
              <div className="filter-chip-list" aria-label="Filtres des recettes">
                <button type="button" className={`filter-chip ${seasonOnly ? "active" : ""}`} onClick={() => setSeasonOnly((value) => !value)}>{seasonOnly ? "✓" : "+"} De saison</button>
                <button type="button" className={`filter-chip ${vegOnly ? "active" : ""}`} onClick={() => setVegOnly((value) => !value)}>{vegOnly ? "✓" : "+"} Végétarien</button>
                {EXTRA_FILTERS.map((filter) => <button type="button" className={`filter-chip ${extraFilters.includes(filter) ? "active" : ""}`} onClick={() => toggleExtraFilter(filter)} key={filter}>{extraFilters.includes(filter) ? "✓" : "+"} {filter}</button>)}
              </div>
              <p className="filter-note">Filtres « sans » calculés d’après les allergènes déclarés dans chaque fiche.</p>
            </div>
          </div>

          <div className="results-row"><span>{filteredDishes.length} recette{filteredDishes.length > 1 ? "s" : ""}</span><span>Ouvrir une catégorie</span></div>
          <div className="dish-accordions">
            {COURSE_ORDER.filter((course) => courseFilter === "Tous" || courseFilter === course).map((course) => {
              const courseDishes = filteredDishes.filter((dish) => dish.course === course);
              const isOpen = openCatalogCourse === course || courseFilter === course || Boolean(query);
              if (!courseDishes.length) return null;
              return <section className={`dish-group ${isOpen ? "open" : ""}`} key={course}>
                <button className="dish-group-toggle" type="button" onClick={() => setOpenCatalogCourse(isOpen && !query ? null : course)} aria-expanded={isOpen}>
                  <span><i className={`course-dot ${course.toLowerCase()}`} /><strong>{course}s</strong><small>{courseDishes.length} recettes</small></span><b>{isOpen ? "−" : "+"}</b>
                </button>
                {isOpen && <div className="dish-grid">{courseDishes.map((dish) => {
              const isSelected = selected.includes(dish.id);
              return (
                <article className={`dish-card ${isSelected ? "selected" : ""}`} key={dish.id}>
                  <div className="dish-compact-main" role="button" tabIndex={0} onClick={() => toggleDish(dish)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); toggleDish(dish); } }} aria-label={`${isSelected ? "Retirer" : "Ajouter"} ${dish.name}`}>
                    <div className="dish-compact-copy"><div className="dish-card-top"><span className={`course-dot ${dish.course.toLowerCase()}`} /><span className="dish-course">{dish.family}</span>{dish.signature && <span className="signature-badge">Signature</span>}</div><h3>{dish.name}</h3></div>
                    <strong className="dish-list-price">{euro.format(dish.price)}</strong>
                    <span className="select-indicator" aria-hidden="true">{isSelected ? "✓" : "+"}</span>
                  </div>
                  <details className="dish-mini-details">
                    <summary>Plus d’infos</summary>
                    <div className="dish-mini-content"><p>{dish.description}</p><div className="dish-tags">{dish.vegetarian && <span>Végétarien</span>}<span>{dish.season.includes("Toute l’année") ? "Toute l’année" : dish.season.join(" · ")}</span></div><p className="economics-note">Estimations de départ — corrigez-les avec vos vrais achats et votre prix de vente.</p><div className="dish-economics editable"><label><span>Coût matière / portion</span><div><input type="number" min="0" step="0.01" value={dish.cost} onChange={(event) => updateDishEconomics(dish, "cost", event.target.value)} /><b>€</b></div></label><label><span>Prix vendu sur la carte</span><div><input type="number" min="0" step="0.5" value={dish.price} onChange={(event) => updateDishEconomics(dish, "price", event.target.value)} /><b>€</b></div></label><div className="calculated-margin"><span>Marge brute calculée</span><strong>{dish.price > 0 ? `${getMargin(dish)}%` : "—"}</strong></div></div><button type="button" className="detail-link" onClick={() => setDetail(dish)}>Fiche recette complète →</button></div>
                  </details>
                </article>
              );
                })}</div>}
              </section>;
            })}
          </div>
          {!filteredDishes.length && <div className="empty-results"><strong>Aucune recette ne correspond.</strong><p>Essayez d’enlever un filtre ou de chercher un autre produit.</p><button type="button" onClick={resetFilters}>Réinitialiser les filtres</button></div>}
        </section>

        <aside id="menu-composer" className={`menu-panel ${mobileMenuOpen ? "mobile-open" : ""}`}>
          <div className="menu-panel-head"><div><p className="eyebrow">Composition en direct</p><input className="menu-title-input" value={menuTitle} onChange={(event) => setMenuTitle(event.target.value)} placeholder={`Menu de ${period.toLowerCase()}`} aria-label="Nom du menu" /></div><button className="mobile-close" type="button" onClick={() => setMobileMenuOpen(false)} aria-label="Fermer">×</button></div>
          <div className={`completion-card ${isComplete ? "complete" : ""}`}>
            <div className="progress-ring" style={{ "--progress": `${Math.round((selected.length / targetTotal) * 100)}%` } as React.CSSProperties}><span>{selected.length}</span></div>
            <div><strong>{isComplete ? "Menu complet" : `${targetTotal - selected.length} choix restant${targetTotal - selected.length > 1 ? "s" : ""}`}</strong><p>{isComplete ? "La structure prévue est respectée." : "Définissez vos volumes puis composez."}</p></div>
          </div>
          <div className="quota-list">
            {COURSE_ORDER.map((course) => <div className="quota-row" key={course}><div><span className={`course-dot ${course.toLowerCase()}`} /><strong>{course}s</strong></div><div className="stepper"><button type="button" onClick={() => changeTarget(course, -1)} disabled={targets[course] <= 1} aria-label={`Retirer un ${course.toLowerCase()}`}>−</button><input key={`${course}-${targets[course]}`} type="number" min="1" max="12" inputMode="numeric" defaultValue={targets[course]} onFocus={(event) => event.currentTarget.select()} onBlur={(event) => { event.currentTarget.value = String(setCourseTarget(course, Number(event.currentTarget.value))); }} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); if (event.key === "Escape") { event.currentTarget.value = String(targets[course]); event.currentTarget.blur(); } }} aria-label={`Nombre de ${course.toLowerCase()}s souhaité`} /><button type="button" onClick={() => changeTarget(course, 1)} disabled={targets[course] >= 12} aria-label={`Ajouter un ${course.toLowerCase()}`}>+</button></div><span className={countFor(course) === targets[course] ? "count done" : "count"}>{countFor(course)}/{targets[course]}</span></div>)}
          </div>
          <div className="selected-sections">
            {COURSE_ORDER.map((course) => {
              const items = selectedDishes.filter((dish) => dish.course === course);
              return <section className="selected-course" key={course}><div className="selected-course-head"><h3>{course}s</h3><span>{items.length}/{targets[course]}</span></div>{items.length ? items.map((dish, index) => <div className="selected-item" key={dish.id}><span className="item-number">{String(index + 1).padStart(2, "0")}</span><button type="button" className="item-name" onClick={() => setDetail(dish)}><strong>{dish.name}</strong><small>{euro.format(dish.cost)} · marge {getMargin(dish)}%</small></button><button type="button" className="remove-item" onClick={() => toggleDish(dish)} aria-label={`Retirer ${dish.name}`}>×</button></div>) : <button type="button" className="empty-slot" onClick={() => { setCourseFilter(course); setMobileMenuOpen(false); }}>+ Choisir {course === "Entrée" ? "une entrée" : course === "Plat" ? "un plat" : "un dessert"}</button>}</section>;
            })}
          </div>
          <div className="menu-footer">
            <div className="menu-score"><span>Équilibre du menu</span><div><i style={{ width: `${balanceScore}%` }} /></div><strong>{balanceScore}/100</strong></div>
            <div className="quality-checks">
              <span className="quality-title">Contrôle de la carte</span>
              {menuChecks.map((check) => <div className={check.ok ? "ok" : "warning"} key={check.label}><i>{check.ok ? "✓" : "!"}</i><span>{check.label}</span></div>)}
            </div>
            <div className="card-memory-actions">
              <button className="save-card-button" type="button" onClick={saveCurrentCard} disabled={!selected.length}><span>✓</span><div><strong>Sauvegarder la carte</strong><small>Garder cet état en mémoire</small></div></button>
              <button className="restore-card-button" type="button" onClick={restoreLastSavedCard} disabled={!lastSavedCard}><span>↶</span><div><strong>Revenir à la dernière carte</strong><small>{lastSavedCard ? `Sauvegardée le ${new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(lastSavedCard.savedAt))}` : "Aucune sauvegarde"}</small></div></button>
            </div>
            <button className="recipe-book-button" type="button" onClick={downloadRecipeBook} disabled={recipeBookBusy}><span>↓</span><div><strong>{recipeBookBusy ? "Création du livre…" : "Télécharger le livre de recettes"}</strong><small>{allDishes.length} fiches techniques · ingrédients, méthode, coûts et allergènes</small></div><b>PDF</b></button>
            <button className="menu-pdf-button" type="button" onClick={downloadCurrentMenuPdf} disabled={pdfBusy || !selectedDishes.length}><span>↓</span><div><strong>{pdfBusy ? "Création du PDF…" : "Télécharger la carte PDF"}</strong><small>Édition élégante · sobre & contemporaine</small></div></button>
            <button className="menu-shopping-button" type="button" onClick={() => setShoppingOpen(true)} disabled={!selectedDishes.length}><span>✓</span><div><strong>Liste de courses & budget</strong><small>{selectedDishes.length ? `${shoppingList.length} produits · environ ${euro.format(shoppingBudget)}` : "Composez d’abord votre menu"}</small></div><b>→</b></button>
            <button className="menu-backup-button" type="button" onClick={downloadApplicationBackup} disabled={backupBusy}><span>⇩</span><div><strong>{backupBusy ? "Création de la sauvegarde…" : "Sauvegarder l’outil (.html)"}</strong><small>Logiciel complet + toutes vos données locales</small></div></button>
            <p className="backup-ios-note">Sur iPhone, le fichier apparaît comme du code dans « Fichiers » : conservez-le, puis restaurez-le avec « Importer ».</p>
            <div className="local-tool-grid">
              <button className="menu-import-button" type="button" onClick={() => backupInputRef.current?.click()}><span>↥</span><strong>Importer une sauvegarde</strong></button>
              {!standaloneMode && <button className={`menu-offline-button ${offlineReady ? "ready" : ""}`} type="button" onClick={() => setInstallOpen(true)}><span>{offlineReady ? "✓" : "◇"}</span><strong>{offlineReady ? "Hors connexion prêt" : "Utiliser hors connexion"}</strong></button>}
            </div>
            <input ref={backupInputRef} className="backup-file-input" type="file" accept=".html,text/html" onChange={importApplicationBackup} aria-label="Choisir une sauvegarde Chez Auguste" />
            <div className="footer-action-grid"><button type="button" onClick={printCurrentMenu}>Imprimer</button><button type="button" onClick={() => setProductionOpen(true)}>Production</button><button type="button" onClick={() => setArchiveOpen(true)}>Archives ({savedMenus.length})</button></div>
            <button className="primary-button full" type="button" onClick={saveMenu}>Archiver ce menu</button>
            <button className="text-button" type="button" onClick={exportMenu}>Exporter en tableau CSV</button>
            <button className="text-button danger" type="button" onClick={() => setSelected([])} disabled={!selected.length}>Vider la sélection</button>
            <button className="reset-data-button" type="button" onClick={restoreOriginalData}>Restaurer les données d’origine</button>
          </div>
        </aside>
      </div>

      {mobileMenuOpen && <button className="drawer-overlay" type="button" onClick={() => setMobileMenuOpen(false)} aria-label="Fermer le menu" />}
      <button className="mobile-menu-bar" type="button" onClick={() => setMobileMenuOpen(true)} aria-label="Ouvrir la composition du menu">
        <span className="mobile-menu-progress"><small>Menu en cours</small><span><strong>{selected.length}/{targetTotal}</strong> recettes choisies</span></span>
        <span className="mobile-menu-cta">Composer le menu <b>→</b></span>
      </button>

      {detail && <div className="modal-backdrop" role="presentation" onMouseDown={() => setDetail(null)}><section className="dish-modal" role="dialog" aria-modal="true" aria-labelledby="dish-modal-title" onMouseDown={(event) => event.stopPropagation()}><button type="button" className="modal-close" onClick={() => setDetail(null)} aria-label="Fermer">×</button><p className="eyebrow">{detail.course} · {detail.family}</p><h2 id="dish-modal-title">{detail.name}</h2><p className="modal-description">{detail.description}</p><div className="modal-kpis"><div><span>Coût portion</span><strong>{euro.format(detail.cost)}</strong></div><div><span>Prix conseillé</span><strong>{euro.format(detail.price)}</strong></div><div><span>Marge brute</span><strong>{getMargin(detail)}%</strong></div><div><span>Mise en place</span><strong>{detail.prep} min</strong></div></div><div className="modal-columns"><div><span className="label">Saisonnalité</span><p>{detail.season.join(", ")}</p></div><div><span className="label">Allergènes</span><p>{detail.allergens.join(", ") || "Aucun déclaré"}</p></div><div><span className="label">Profil</span><p>{detail.tags.join(" · ")}</p></div><div><span className="label">Complexité</span><p>{"●".repeat(detail.difficulty)}{"○".repeat(3 - detail.difficulty)}</p></div></div><div className="detail-actions"><button className="technical-button" type="button" onClick={() => openTechnicalSheet(detail)}>Fiche technique →</button><button className={`primary-button ${selected.includes(detail.id) ? "remove" : ""}`} type="button" onClick={() => { toggleDish(detail); setDetail(null); }}>{selected.includes(detail.id) ? "Retirer du menu" : "Ajouter au menu"}</button></div></section></div>}

      {technicalDish && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setTechnicalDish(null)}>
          <section className="tool-modal technical-modal" role="dialog" aria-modal="true" aria-labelledby="technical-title" onMouseDown={(event) => event.stopPropagation()}>
            <button type="button" className="modal-close" onClick={() => setTechnicalDish(null)} aria-label="Fermer">×</button>
            <div className="technical-heading"><div><div className="technical-heading-line"><p className="eyebrow">Fiche technique</p><select value={technicalDish.course} onChange={(event) => updateTechnicalDishField("course", event.target.value as Course)} aria-label="Type de recette">{COURSE_ORDER.map((course) => <option key={course}>{course}</option>)}</select></div><input className="technical-title-input" id="technical-title" value={technicalDish.name} onChange={(event) => updateTechnicalDishField("name", event.target.value)} aria-label="Nom de la recette" /><textarea className="technical-description-input" value={technicalDish.description} onChange={(event) => updateTechnicalDishField("description", event.target.value)} aria-label="Description de la recette" /></div><span>Sauvegarde automatique</span></div>
            <div className="technical-toolbar">
              <div><span>Nombre de portions</span><div className="technical-stepper"><button type="button" onClick={() => setTechnicalPortions((value) => Math.max(1, value - 1))}>−</button><input type="number" min="1" value={technicalPortions} onChange={(event) => setTechnicalPortions(Math.max(1, Number(event.target.value) || 1))} aria-label="Nombre de portions" /><button type="button" onClick={() => setTechnicalPortions((value) => value + 1)}>+</button></div></div>
              <div className="technical-summary"><div><span>Coût total estimé</span><strong>{euro.format(technicalDish.cost * technicalPortions)}</strong></div><label><span>Coût par portion (€)</span><input type="number" min="0" step="0.01" value={technicalDish.cost} onChange={(event) => updateTechnicalCost(event.target.value)} /></label><label><span>Temps de mise en place (min)</span><input type="number" min="1" value={technicalDish.prep} onChange={(event) => updateTechnicalDishField("prep", Math.max(1, Number(event.target.value) || 1))} /></label></div>
            </div>
            <div className="technical-grid">
              <section className="ingredient-sheet"><div className="technical-section-title"><h3>Ingrédients</h3><span>Pour {technicalPortions} portions</span></div><div className="ingredient-table editable-ingredient-table"><div className="ingredient-row ingredient-head"><span>Produit</span><span>Quantité</span><span>Unité</span><span /></div>{technicalIngredients.map((ingredient, index) => <div className="ingredient-row" key={index}><input value={ingredient.name} onChange={(event) => updateIngredient(index, { name: event.target.value })} aria-label={`Nom de l’ingrédient ${index + 1}`} /><input type="number" min="0" step="0.1" value={Math.round(ingredient.quantity * technicalPortions * 10) / 10} onChange={(event) => updateIngredient(index, { quantity: Math.max(0, Number(event.target.value) || 0) / technicalPortions })} aria-label={`Quantité de ${ingredient.name}`} /><select value={ingredient.unit} onChange={(event) => updateIngredient(index, { unit: event.target.value as IngredientLine["unit"] })} aria-label={`Unité de ${ingredient.name}`}><option>g</option><option>ml</option><option>pièce</option></select><button type="button" onClick={() => removeIngredient(index)} aria-label={`Supprimer ${ingredient.name}`}>×</button></div>)}</div><button type="button" className="add-sheet-line" onClick={addIngredient}>+ Ajouter un ingrédient</button></section>
              <section className="method-sheet"><div className="technical-section-title"><h3>Déroulé</h3><span>{technicalSteps.length} étapes</span></div><ol>{technicalSteps.map((step, index) => <li key={index}><i>{index + 1}</i><textarea value={step} onChange={(event) => updateStep(index, event.target.value)} aria-label={`Étape ${index + 1}`} /><button type="button" onClick={() => removeStep(index)} aria-label={`Supprimer l’étape ${index + 1}`}>×</button></li>)}</ol><button type="button" className="add-sheet-line" onClick={addStep}>+ Ajouter une étape</button></section>
            </div>
            <div className="technical-footer"><label><span>Allergènes déclarés</span><input value={technicalDish.allergens.join(", ")} onChange={(event) => updateTechnicalDishField("allergens", event.target.value.split(",").map((item) => item.trim()).filter(Boolean))} placeholder="Gluten, lait, œuf…" /></label><p>Toutes les modifications sont enregistrées automatiquement sur cet appareil. Les grammages restent à valider par le chef avant utilisation en production.</p></div>
          </section>
        </div>
      )}

      {createOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setCreateOpen(false)}>
          <section className="tool-modal recipe-form-modal" role="dialog" aria-modal="true" aria-labelledby="recipe-form-title" onMouseDown={(event) => event.stopPropagation()}>
            <button type="button" className="modal-close" onClick={() => setCreateOpen(false)} aria-label="Fermer">×</button>
            <p className="eyebrow">Carte maître</p><h2 id="recipe-form-title">Ajouter un produit avec la magie</h2><p className="tool-modal-intro">Écrivez simplement l’intitulé. Le programme propose son classement, sa saison, ses allergènes et une première base économique.</p>
            <div className="magic-entry"><label><span>Intitulé du produit</span><input autoFocus value={newDish.name} onChange={(event) => setNewDish({ ...newDish, name: event.target.value })} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); runMagicClassification(); } }} placeholder="Ex. Joue de bœuf braisée aux carottes" /></label><button type="button" onClick={runMagicClassification} disabled={newDish.name.trim().length < 3}>{magicAnalyzed ? "✦ Reclasser" : "✦ Classer automatiquement"}</button></div>
            {!magicAnalyzed && <div className="magic-hint"><span>1</span><p>Saisissez le nom du produit</p><i>→</i><span>2</span><p>Vérifiez le classement proposé</p><i>→</i><span>3</span><p>Ajoutez-le à la carte</p></div>}
            {magicAnalyzed && <>
              <div className="classification-heading"><strong>Proposition automatique</strong><span>✎ Chaque champ est modifiable</span></div>
              <div className="classification-result">
                <label><span>Type</span><select value={newDish.course} onChange={(event) => setNewDish({ ...newDish, course: event.target.value as Course })} aria-label="Corriger le type de plat">{COURSE_ORDER.map((course) => <option key={course}>{course}</option>)}</select></label>
                <label><span>Famille</span><input required list="recipe-family-options" value={newDish.family} onChange={(event) => setNewDish({ ...newDish, family: event.target.value })} aria-label="Corriger la famille" /></label>
                <label><span>Saison</span><select value={newDish.season} onChange={(event) => setNewDish({ ...newDish, season: event.target.value })} aria-label="Corriger la saison"><option>Toute l’année</option>{SEASONS.map((season) => <option key={season}>{season}</option>)}</select></label>
                <label><span>Profil</span><select value={newDish.dietProfile} onChange={(event) => { const dietProfile = event.target.value as DietProfile; setNewDish({ ...newDish, dietProfile, vegetarian: dietProfile === "Végétarien" }); }} aria-label="Corriger le profil du plat"><option>Végétarien</option><option>Viande</option><option>Poisson</option></select></label>
              </div>
              <datalist id="recipe-family-options">{FAMILY_OPTIONS.map((family) => <option value={family} key={family} />)}</datalist>
              <p className="classification-note"><strong>Une erreur ?</strong> Corrigez-la directement ci-dessus, puis validez. Aucun nouveau calcul n’est imposé.</p>
              <form className="recipe-form" onSubmit={createRecipe}>
                <div className="form-section-title wide"><strong>Détails de la recette</strong><span>Déjà préremplis, modifiez seulement ce qui compte</span></div>
                <label className="wide"><span>Description carte</span><textarea value={newDish.description} onChange={(event) => setNewDish({ ...newDish, description: event.target.value })} placeholder="Garniture, sauce et finition…" /></label>
                <label><span>Mise en place (min)</span><input type="number" min="1" value={newDish.prep} onChange={(event) => setNewDish({ ...newDish, prep: event.target.value })} /></label>
                <label><span>Coût portion (€) *</span><input required inputMode="decimal" value={newDish.cost} onChange={(event) => setNewDish({ ...newDish, cost: event.target.value })} placeholder="4,20" /></label>
                <label><span>Prix carte (€) *</span><input required inputMode="decimal" value={newDish.price} onChange={(event) => setNewDish({ ...newDish, price: event.target.value })} placeholder="18,00" /></label>
                <label className="wide"><span>Allergènes, séparés par une virgule</span><input value={newDish.allergens} onChange={(event) => setNewDish({ ...newDish, allergens: event.target.value })} placeholder="Gluten, lait, œuf…" /></label>
                <button className="primary-button wide" type="submit">Ajouter à la carte maître</button>
              </form>
            </>}
          </section>
        </div>
      )}

      {archiveOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setArchiveOpen(false)}>
          <section className="tool-modal archive-modal" role="dialog" aria-modal="true" aria-labelledby="archive-title" onMouseDown={(event) => event.stopPropagation()}>
            <button type="button" className="modal-close" onClick={() => setArchiveOpen(false)} aria-label="Fermer">×</button>
            <p className="eyebrow">Historique</p><h2 id="archive-title">Menus archivés</h2><p className="tool-modal-intro">Rechargez une ancienne carte, puis adaptez-la à la nouvelle saison.</p>
            {savedMenus.length ? <div className="archive-list">{savedMenus.map((menu) => <article className="archive-card" key={menu.id}><div><span>{menu.periodType} · {menu.period}</span><h3>{menu.title}</h3><p>{menu.selected.length} recettes · sauvegardé le {new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(menu.createdAt))}</p></div><button type="button" onClick={() => loadMenu(menu)}>Ouvrir →</button></article>)}</div> : <div className="archive-empty"><strong>Aucun menu archivé</strong><p>Composez une carte puis cliquez sur « Archiver ce menu ».</p></div>}
            <button className="ghost-button full" type="button" onClick={exportMenu}>Exporter le menu actuel en CSV</button>
          </section>
        </div>
      )}

      {productionOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setProductionOpen(false)}>
          <section className="tool-modal production-modal" role="dialog" aria-modal="true" aria-labelledby="production-title" onMouseDown={(event) => event.stopPropagation()}>
            <button type="button" className="modal-close" onClick={() => setProductionOpen(false)} aria-label="Fermer">×</button>
            <p className="eyebrow">Organisation cuisine</p><h2 id="production-title">Plan de production</h2><p className="tool-modal-intro">Estimation de la mise en place si les ventes sont réparties équitablement entre les choix.</p>
            <div className="forecast-controls"><label><span>Couverts prévus</span><input type="number" min="1" value={covers} onChange={(event) => setCovers(Math.max(1, Number(event.target.value)))} /></label><label><span>Marge de sécurité</span><select value={buffer} onChange={(event) => setBuffer(Number(event.target.value))}><option value={0}>0 %</option><option value={5}>5 %</option><option value={10}>10 %</option><option value={15}>15 %</option><option value={20}>20 %</option></select></label></div>
            <div className="forecast-kpis"><div><span>Portions avec sécurité</span><strong>{Math.ceil(covers * (1 + buffer / 100))}</strong></div><div><span>Budget matière estimé</span><strong>{euro.format(projectedFoodCost)}</strong></div><div><span>Coût menu moyen</span><strong>{euro.format(averagePlateCost)}</strong></div></div>
            <div className="production-list">
              {COURSE_ORDER.map((course) => {
                const items = selectedDishes.filter((dish) => dish.course === course);
                return <section key={course}><div className="production-course-title"><h3>{course}s</h3><span>{items.length} choix</span></div>{items.length ? items.map((dish) => <div className="production-row" key={dish.id}><div><strong>{dish.name}</strong><small>{dish.prep} min de mise en place · coût {euro.format(dish.cost)}</small></div><span>{Math.ceil((covers / items.length) * (1 + buffer / 100))} portions</span></div>) : <p className="production-missing">Aucune recette sélectionnée.</p>}</section>;
              })}
            </div>
            <div className="production-note"><strong>Calcul automatique disponible</strong><span>La liste de courses reprend les grammages actuels des fiches techniques et regroupe les produits identiques.</span></div>
            <button className="primary-button full production-shopping-link" type="button" onClick={() => { setProductionOpen(false); setShoppingOpen(true); }} disabled={!selectedDishes.length}>Voir la liste de courses & le budget →</button>
          </section>
        </div>
      )}
      {shoppingOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setShoppingOpen(false)}>
          <section className="tool-modal shopping-modal" role="dialog" aria-modal="true" aria-labelledby="shopping-title" onMouseDown={(event) => event.stopPropagation()}>
            <button type="button" className="modal-close" onClick={() => setShoppingOpen(false)} aria-label="Fermer">×</button>
            <p className="eyebrow">Achats & coût matière</p><h2 id="shopping-title">Liste de courses & budget</h2><p className="tool-modal-intro">Les ventes sont réparties équitablement entre les recettes de chaque catégorie. Les quantités viennent directement de vos fiches techniques.</p>
            <div className="forecast-controls"><label><span>Couverts prévus</span><input type="number" min="1" value={covers} onChange={(event) => setCovers(Math.max(1, Number(event.target.value) || 1))} /></label><label><span>Marge de sécurité</span><select value={buffer} onChange={(event) => setBuffer(Number(event.target.value))}><option value={0}>0 %</option><option value={5}>5 %</option><option value={10}>10 %</option><option value={15}>15 %</option><option value={20}>20 %</option></select></label></div>
            <div className="forecast-kpis shopping-kpis"><div><span>Produits à acheter</span><strong>{shoppingList.length}</strong></div><div><span>Budget matière estimé</span><strong>{euro.format(shoppingBudget)}</strong></div><div><span>Coût menu moyen</span><strong>{euro.format(averagePlateCost)}</strong></div></div>
            <div className="shopping-table"><div className="shopping-row shopping-head"><span /><span>Produit</span><span>Quantité estimée</span></div>{shoppingList.map((item) => <label className="shopping-row" key={`${item.name}-${item.unit}`}><input type="checkbox" /><strong>{item.name}</strong><span>{formatShoppingQuantity(item)}</span></label>)}</div>
            <details className="shopping-plan-details"><summary>Voir la répartition utilisée</summary><div>{COURSE_ORDER.map((course) => { const items = shoppingPlan.filter((item) => item.dish.course === course); return items.length ? <section key={course}><h3>{course}s</h3>{items.map((item) => <p key={item.dish.id}><span>{item.dish.name}</span><strong>{item.portions} portions</strong></p>)}</section> : null; })}</div></details>
            <p className="shopping-disclaimer"><strong>Estimation :</strong> le budget utilise le coût matière par portion enregistré sur chaque recette. Vérifiez les conditionnements et les tarifs réels de vos fournisseurs avant de commander.</p>
            <div className="shopping-actions"><button className="ghost-button" type="button" onClick={printShoppingList}>Imprimer / enregistrer en PDF</button><button className="primary-button" type="button" onClick={() => setShoppingOpen(false)}>Terminer</button></div>
          </section>
        </div>
      )}
      {installOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setInstallOpen(false)}>
          <section className="tool-modal install-modal" role="dialog" aria-modal="true" aria-labelledby="install-title" onMouseDown={(event) => event.stopPropagation()}>
            <button type="button" className="modal-close" onClick={() => setInstallOpen(false)} aria-label="Fermer">×</button>
            <p className="eyebrow">Utilisation locale sur iPhone</p><h2 id="install-title">Installer Chez Auguste</h2>
            <p className="tool-modal-intro">Une fois ajouté à l’écran d’accueil, le programme reste disponible sans connexion. Les données restent enregistrées sur cet iPhone.</p>
            <div className="install-steps">
              <div><i>1</i><p><strong>Ouvrez cette page dans Safari</strong><span>Depuis cet écran, touchez l’icône boussole.</span></p></div>
              <div><i>2</i><p><strong>Touchez le bouton Partager</strong><span>Le carré avec la flèche vers le haut.</span></p></div>
              <div><i>3</i><p><strong>Choisissez « Sur l’écran d’accueil »</strong><span>Chez Auguste s’ouvrira ensuite comme une application.</span></p></div>
            </div>
            <div className={`offline-status ${offlineReady ? "ready" : ""}`}><i>{offlineReady ? "✓" : "…"}</i><div><strong>{offlineReady ? "Mode hors connexion préparé" : "Préparation du mode hors connexion"}</strong><span>{offlineReady ? "Vous pouvez maintenant l’ajouter à l’écran d’accueil." : "Gardez cette page ouverte encore un instant."}</span></div></div>
            <p className="install-backup-tip"><strong>Pour récupérer la sauvegarde montrée sur votre capture :</strong> revenez ensuite dans ce menu et choisissez « Importer une sauvegarde ».</p>
          </section>
        </div>
      )}
      {notice && <div className="toast" role="status">{notice}</div>}
      </>}
    </main>
  );
}
