import uniquesCsvRaw from "../../uniques.csv?raw";

export const DEFAULT_BASE_ITEMS = 1.25;
export const DEFAULT_BASE_FOULBORN_RATE = 0.225;
export const MAX_POINT_HINT = 18;
export const ROOT_NODE = "__womb__";
export const VARIANT_OPTIONS = [
  { value: "any", label: "Any" },
  { value: "normal", label: "Avoid Foulborn" },
  { value: "normalAvoidL", label: "Avoid Corrupted Non-Foulborn" },
  { value: "foulborn", label: "Want Foulborn" },
  { value: "foulbornAvoidL", label: "Want Foulborn Without L" },
  { value: "foulbornForceK", label: "Need Multiple Foulborn Modifiers" },
  { value: "foulbornForceKAvoidL", label: "Need Multiple Foulborn Modifiers Without L" },
];

const TIER_COEFFICIENTS = {
  5: 1,
  4: 1.25,
  3: 2,
  2: 6,
  1: 25,
  0: 100,
  TF: 200,
  "T-1": 200,
};

const RARITY_RANKS = {
  5: 0,
  4: 1,
  3: 2,
  2: 3,
  1: 4,
  0: 5,
  TF: 6,
  "T-1": 6,
};

const WEAPON_CLASSES = new Set([
  "Two Hand Axe",
  "One Hand Axe",
  "Two Hand Mace",
  "Sceptre",
  "One Hand Mace",
  "Two Hand Sword",
  "One Hand Sword",
  "Staff",
  "Dagger",
  "Claw",
  "Wand",
  "Bow",
]);
const RANGED_WEAPON_CLASSES = new Set(["Wand", "Bow"]);
const TWO_HANDED_MELEE_CLASSES = new Set(["Two Hand Axe", "Two Hand Mace", "Two Hand Sword", "Staff"]);
const ONE_HANDED_MELEE_CLASSES = new Set(["One Hand Axe", "Sceptre", "One Hand Mace", "One Hand Sword", "Dagger", "Claw"]);
const ARMOUR_CLASSES = new Set(["Shield", "Helmet", "Body Armour", "Gloves", "Boots"]);
const JEWELLERY_CLASSES = new Set(["Belt", "Ring", "Amulet"]);

const ATTRIBUTE_MORE = {
  a2: "strength",
  a4: "intelligence",
  a5: "dexterity",
};

const ATTRIBUTE_LESS = {
  a1: "strength",
  a3: "intelligence",
  a6: "dexterity",
};

const SMALL_ADDITIONAL_ITEM_PASSIVES = new Set(["a", "b", "c", "e", "f", "g"]);
const FOULBORN_INCREASES = {
  E: 0.3,
  L: 1,
};
const FOULBORN_ZERO_PASSIVES = new Set(["A"]);
const UNSUPPORTED_PASSIVES = new Set(["C", "J", "N"]);
const EXCLUDED_BOSS_DROP_ONLY_UNIQUES = new Set([
  normalizeText("Malachai's Mark"),
  normalizeText("Manastorm"),
  normalizeText("The Dark Seer"),
  normalizeText("Wraithlord"),
  normalizeText("Yoke of Suffering"),
]);

export const TREE_CHILDREN = {
  [ROOT_NODE]: ["a", "d"],
  a: ["a1", "a2", "a3", "a4", "a5", "a6", "b"],
  b: ["c", "A", "B", "C"],
  c: ["c1", "c2", "c3"],
  B: ["B1", "B2", "B3"],
  d: ["D", "e"],
  D: ["D1", "D2", "D3"],
  e: ["E", "F", "G", "H", "f"],
  F: ["F1", "F2", "F3", "F4", "F5"],
  f: ["J", "K", "g"],
  g: ["L", "M", "N"],
};

export const TREE_PARENTS = Object.fromEntries(
  Object.entries(TREE_CHILDREN).flatMap(([parent, children]) => children.map((child) => [child, parent]))
);

export const PASSIVES = {
  a: { id: "a", name: "Additional Item Chance", summary: "+0.10 expected items per wombgift", supported: true, affectsRate: true },
  a1: { id: "a1", name: "Less Strength Items", summary: "0.15x weight for uniques with Strength requirements", supported: true, affectsRate: true },
  a2: { id: "a2", name: "More Strength Items", summary: "4.0x weight for uniques with Strength requirements", supported: true, affectsRate: true },
  a3: { id: "a3", name: "Less Intelligence Items", summary: "0.15x weight for uniques with Intelligence requirements", supported: true, affectsRate: true },
  a4: { id: "a4", name: "More Intelligence Items", summary: "4.0x weight for uniques with Intelligence requirements", supported: true, affectsRate: true },
  a5: { id: "a5", name: "More Dexterity Items", summary: "4.0x weight for uniques with Dexterity requirements", supported: true, affectsRate: true },
  a6: { id: "a6", name: "Less Dexterity Items", summary: "0.15x weight for uniques with Dexterity requirements", supported: true, affectsRate: true },
  b: { id: "b", name: "Additional Item Chance", summary: "+0.10 expected items per wombgift", supported: true, affectsRate: true },
  c: { id: "c", name: "Additional Item Chance", summary: "+0.10 expected items per wombgift", supported: true, affectsRate: true },
  c1: { id: "c1", name: "Increased Flasks Chance", summary: "+500% selection weight for flasks", supported: true, affectsRate: true },
  c2: { id: "c2", name: "Increased Quivers Chance", summary: "+500% selection weight for quivers", supported: true, affectsRate: true },
  c3: { id: "c3", name: "Increased Jewels Chance", summary: "+500% selection weight for jewels", supported: true, affectsRate: true },
  A: { id: "A", name: "Cleansed of Impurity", summary: "Sets foulborn conversion chance to 0 for items with a foulborn variant", supported: true, affectsRate: true },
  B: { id: "B", name: "Glittering Lineage", summary: "+100% selection weight for jewellery", supported: true, affectsRate: true },
  B1: { id: "B1", name: "Increased Belts Chance", summary: "+1000% selection weight for belts", supported: true, affectsRate: true },
  B2: { id: "B2", name: "Increased Rings Chance", summary: "+1000% selection weight for rings", supported: true, affectsRate: true },
  B3: { id: "B3", name: "Increased Amulets Chance", summary: "+1000% selection weight for amulets", supported: true, affectsRate: true },
  C: { id: "C", name: "Lord's Descent", summary: "+150% selection weight for breach-specific uniques", supported: false, affectsRate: true },
  d: { id: "d", name: "Lucky Sockets", summary: "No effect on target-drop rate", supported: true, affectsRate: false },
  D: { id: "D", name: "Martial Lineage", summary: "+100% selection weight for weapons", supported: true, affectsRate: true },
  D1: { id: "D1", name: "Increased Ranged Weapons Chance", summary: "+1000% selection weight for ranged weapons", supported: true, affectsRate: true },
  D2: { id: "D2", name: "Increased Two-Hander Chance", summary: "+1000% selection weight for two-handed melee weapons", supported: true, affectsRate: true },
  D3: { id: "D3", name: "Increased One-Handed Melee Weapons Chance", summary: "+1000% selection weight for one-handed melee weapons", supported: true, affectsRate: true },
  e: { id: "e", name: "Additional Item Chance", summary: "+0.10 expected items per wombgift", supported: true, affectsRate: true },
  E: { id: "E", name: "Foulborn Gluttony", summary: "+0.30 expected items per wombgift and +30% foulborn chance multiplier", supported: true, affectsRate: true },
  F: { id: "F", name: "Guardian Lineage", summary: "+100% selection weight for armour", supported: true, affectsRate: true },
  F1: { id: "F1", name: "Increased Shields Chance", summary: "+1000% selection weight for shields", supported: true, affectsRate: true },
  F2: { id: "F2", name: "Increased Helmets Chance", summary: "+1000% selection weight for helmets", supported: true, affectsRate: true },
  F3: { id: "F3", name: "Increased Body Armour Chance", summary: "+1000% selection weight for body armours", supported: true, affectsRate: true },
  F4: { id: "F4", name: "Increased Gloves Chance", summary: "+1000% selection weight for gloves", supported: true, affectsRate: true },
  F5: { id: "F5", name: "Increased Boots Chance", summary: "+1000% selection weight for boots", supported: true, affectsRate: true },
  G: { id: "G", name: "Unstable Growth", summary: "No effect on target-drop rate", supported: true, affectsRate: false },
  H: { id: "H", name: "Throbbing Veins", summary: "No effect on target-drop rate", supported: true, affectsRate: false },
  f: { id: "f", name: "Additional Item Chance", summary: "+0.10 expected items per wombgift", supported: true, affectsRate: true },
  J: { id: "J", name: "Foulborn Ancestry", summary: "+50% breach-specific weight and +50% foulborn chance multiplier", supported: false, affectsRate: true },
  K: { id: "K", name: "Extremely Foul", summary: "No effect on whether the target unique drops", supported: true, affectsRate: false },
  g: { id: "g", name: "Additional Item Chance", summary: "+0.10 expected items per wombgift", supported: true, affectsRate: true },
  L: { id: "L", name: "Corrupted Flesh", summary: "+100% foulborn chance multiplier", supported: true, affectsRate: true },
  M: { id: "M", name: "Recessive Genes", summary: "Roll twice and keep the intrinsically rarer tier", supported: true, affectsRate: true },
  N: { id: "N", name: "Remembered Origins", summary: "+300% breach-specific weight and sets foulborn conversion chance to 0", supported: false, affectsRate: true },
};

export const TREE_NODE_IDS = Object.keys(PASSIVES);
const SUPPORTED_TREE_NODE_IDS = TREE_NODE_IDS.filter((passiveId) => PASSIVES[passiveId].supported);
const EXACT_CANDIDATE_SLACK = 6;
const REQUIRED_BEST_TREE_PASSIVES = ["a", "d"];

export const NODE_LAYOUT = {
  a: { x: 327.6, y: 589.6, radius: 32.0 },
  a1: { x: 222.3, y: 650.2, radius: 28.0 },
  a2: { x: 222.3, y: 526.1, radius: 29.0 },
  a3: { x: 327.6, y: 464.0, radius: 27.0 },
  a4: { x: 435.9, y: 523.2, radius: 31.0 },
  a5: { x: 435.9, y: 648.7, radius: 27.0 },
  a6: { x: 329.1, y: 712.3, radius: 28.5 },
  b: { x: 492.1, y: 302.4, radius: 28.5 },
  c: { x: 343.5, y: 302.4, radius: 28.5 },
  c1: { x: 236.7, y: 365.9, radius: 29.0 },
  c2: { x: 236.7, y: 241.8, radius: 29.5 },
  c3: { x: 344.9, y: 181.1, radius: 29.0 },
  A: { x: 490.7, y: 71.5, radius: 48.0 },
  B: { x: 697.1, y: 186.9, radius: 47.0 },
  B1: { x: 698.5, y: 62.8, radius: 29.5 },
  B2: { x: 802.4, y: 123.4, radius: 29.5 },
  B3: { x: 805.3, y: 249.0, radius: 30.0 },
  C: { x: 691.3, y: 391.9, radius: 48.0 },
  d: { x: 526.8, y: 824.8, radius: 29.5 },
  D: { x: 637.9, y: 628.5, radius: 46.0 },
  D1: { x: 640.8, y: 503.0, radius: 28.5 },
  D2: { x: 728.8, y: 537.6, radius: 28.5 },
  D3: { x: 764.9, y: 625.7, radius: 29.5 },
  e: { x: 945.3, y: 709.4, radius: 30.0 },
  E: { x: 902.0, y: 464.0, radius: 47.5 },
  F: { x: 1164.7, y: 257.6, radius: 48.0 },
  F1: { x: 1079.5, y: 165.3, radius: 30.5 },
  F2: { x: 1164.7, y: 126.3, radius: 30.5 },
  F3: { x: 1251.3, y: 166.7, radius: 31.0 },
  F4: { x: 1290.2, y: 250.4, radius: 30.0 },
  F5: { x: 1252.7, y: 341.3, radius: 32.0 },
  G: { x: 1223.9, y: 490.0, radius: 45.5 },
  H: { x: 1182.0, y: 772.9, radius: 48.0 },
  f: { x: 1361.0, y: 583.8, radius: 29.0 },
  J: { x: 1508.2, y: 334.1, radius: 48.0 },
  K: { x: 1694.4, y: 585.2, radius: 48.0 },
  g: { x: 1707.3, y: 380.3, radius: 31.0 },
  L: { x: 1664.0, y: 78.7, radius: 48.0 },
  M: { x: 1912.3, y: 152.3, radius: 48.0 },
  N: { x: 2016.2, y: 383.2, radius: 48.0 },
};

const WEIGHT_INCREASES = {
  c1: { increase: 5, match: (item) => item.itemClass === "Flask" },
  c2: { increase: 5, match: (item) => item.itemClass === "Quiver" },
  c3: { increase: 5, match: (item) => item.itemClass === "Jewel" },
  B: { increase: 1, match: (item) => JEWELLERY_CLASSES.has(item.itemClass) },
  B1: { increase: 10, match: (item) => item.itemClass === "Belt" },
  B2: { increase: 10, match: (item) => item.itemClass === "Ring" },
  B3: { increase: 10, match: (item) => item.itemClass === "Amulet" },
  D: { increase: 1, match: (item) => WEAPON_CLASSES.has(item.itemClass) },
  D1: { increase: 10, match: (item) => RANGED_WEAPON_CLASSES.has(item.itemClass) },
  D2: { increase: 10, match: (item) => TWO_HANDED_MELEE_CLASSES.has(item.itemClass) },
  D3: { increase: 10, match: (item) => ONE_HANDED_MELEE_CLASSES.has(item.itemClass) },
  F: { increase: 1, match: (item) => ARMOUR_CLASSES.has(item.itemClass) },
  F1: { increase: 10, match: (item) => item.itemClass === "Shield" },
  F2: { increase: 10, match: (item) => item.itemClass === "Helmet" },
  F3: { increase: 10, match: (item) => item.itemClass === "Body Armour" },
  F4: { increase: 10, match: (item) => item.itemClass === "Gloves" },
  F5: { increase: 10, match: (item) => item.itemClass === "Boots" },
};

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (inQuotes) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += character;
      }
      continue;
    }

    if (character === '"') {
      inQuotes = true;
    } else if (character === ",") {
      row.push(cell);
      cell = "";
    } else if (character === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (character !== "\r") {
      cell += character;
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  const [rawHeader = [], ...dataRows] = rows;
  const header = rawHeader.map((column, columnIndex) => (columnIndex === 0 ? column.replace(/^\ufeff/, "") : column));

  return dataRows
    .filter((dataRow) => dataRow.some((value) => value !== ""))
    .map((dataRow) =>
      Object.fromEntries(header.map((column, index) => [column, dataRow[index] ?? ""]))
    );
}

export function normalizeText(value = "") {
  return value
    .replaceAll("’", "'")
    .replaceAll("‘", "'")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .join(" ");
}

function parseLevel(value) {
  const text = String(value ?? "").trim();
  return text ? Number.parseInt(text, 10) : 0;
}

function normalizeTier(value) {
  const tier = String(value ?? "").trim().toUpperCase();
  return tier in TIER_COEFFICIENTS ? tier : "";
}

function normalizeDropPool(value) {
  return String(value ?? "").trim().toLowerCase() === "breach-only" ? "breach-only" : "core";
}

function loadItemsFromCsvText(text) {
  return parseCsv(text)
    .map((row) => ({
      name: String(row.name ?? "").trim(),
      itemClass: String(row.item_class ?? "").trim(),
      dropPool: normalizeDropPool(row.drop_pool),
      isBreachUnique: String(row.is_breach_unique ?? "").trim().toLowerCase() === "yes",
      tier: normalizeTier(row.tier),
      tierRaw: String(row.tier_raw ?? "").trim(),
      requiredLevel: parseLevel(row.required_level),
      requiredStrength: parseLevel(row.required_strength),
      requiredDexterity: parseLevel(row.required_dexterity),
      requiredIntelligence: parseLevel(row.required_intelligence),
      attributeRequirements: String(row.attribute_requirements ?? "").trim() || "None",
      hasStrengthRequirement: parseLevel(row.required_strength) > 0,
      hasDexterityRequirement: parseLevel(row.required_dexterity) > 0,
      hasIntelligenceRequirement: parseLevel(row.required_intelligence) > 0,
      hasFoulbornVariant: String(row.has_foulborn_variant ?? "").trim().toLowerCase() === "yes",
      wikiPage: String(row.wiki_page ?? "").trim(),
    }))
    .filter((item) => item.name && item.itemClass)
    .filter((item) => !EXCLUDED_BOSS_DROP_ONLY_UNIQUES.has(normalizeText(item.name)))
    .sort((left, right) => left.name.localeCompare(right.name));
}

export const CSV_ITEMS = loadItemsFromCsvText(uniquesCsvRaw);
const MODELED_ITEMS = CSV_ITEMS.filter((item) => item.dropPool === "core");
export const ALL_ITEMS = CSV_ITEMS;
export const ITEM_NAME_INDEX = new Map(ALL_ITEMS.map((item) => [normalizeText(item.name), item]));

export function tierLabel(item) {
  return item.tier ? item.tier : "?";
}

export function attributeLabel(item) {
  return item.attributeRequirements || "None";
}

export function formatValue(value, defaultFractionDigits = 2, maxFractionDigits = 8) {
  if (!Number.isFinite(value)) {
    return "-";
  }

  if (Object.is(value, -0) || value === 0) {
    return "0";
  }

  let digits = defaultFractionDigits;
  let formatted = value.toFixed(digits);
  while (digits < maxFractionDigits && Number(formatted) === 0) {
    digits += 1;
    formatted = value.toFixed(digits);
  }

  return formatted.replace(/(\.\d*?[1-9])0+$/u, "$1").replace(/\.0+$/u, "");
}

export function formatPercent(value) {
  return `${formatValue(value * 100)}%`;
}

export function formatRatio(value) {
  const delta = (value - 1) * 100;
  return `${formatValue(value)}x (${delta >= 0 ? "+" : ""}${formatValue(delta)}%)`;
}

export function describeVariant(variant) {
  if (variant === "any") {
    return "any version";
  }
  if (variant === "normal") {
    return "non-foulborn only";
  }
  if (variant === "normalAvoidL") {
    return "non-foulborn only without L";
  }
  if (variant === "foulbornAvoidL") {
    return "foulborn only without L";
  }
  if (variant === "foulbornForceK") {
    return "foulborn only with K required";
  }
  if (variant === "foulbornForceKAvoidL") {
    return "foulborn only with K required and without L";
  }
  return "foulborn only";
}

function variantFamily(variant) {
  if (variant === "any") {
    return "any";
  }
  if (variant === "foulborn" || variant === "foulbornAvoidL" || variant === "foulbornForceK" || variant === "foulbornForceKAvoidL") {
    return "foulborn";
  }
  return "normal";
}

function requiredVariantPassives(variant) {
  return variant === "foulbornForceK" || variant === "foulbornForceKAvoidL" ? ["K"] : [];
}

function forbiddenVariantPassives(variant) {
  return variant === "normalAvoidL" || variant === "foulbornAvoidL" || variant === "foulbornForceKAvoidL" ? ["L"] : [];
}

function allocationMatchesVariantConstraints(variant, passives) {
  const selected = new Set(passives);
  return requiredVariantPassives(variant).every((passiveId) => selected.has(passiveId))
    && forbiddenVariantPassives(variant).every((passiveId) => !selected.has(passiveId));
}

export function variantNeedsFoulbornTarget(variant) {
  return variantFamily(variant) === "foulborn";
}

export function searchItems(query, limit = 12) {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) {
    return ALL_ITEMS.slice(0, limit);
  }

  const begins = [];
  const contains = [];
  for (const item of ALL_ITEMS) {
    const normalizedName = normalizeText(item.name);
    if (normalizedName.startsWith(normalizedQuery)) {
      begins.push(item);
    } else if (normalizedName.includes(normalizedQuery)) {
      contains.push(item);
    }
    if (begins.length + contains.length >= limit) {
      break;
    }
  }

  return [...begins, ...contains].slice(0, limit);
}

export function filterEligibleItems(levelCap) {
  const items = [];
  let excludedUnknownTiers = 0;

  for (const item of MODELED_ITEMS) {
    if (item.requiredLevel > levelCap) {
      continue;
    }
    if (!item.tier) {
      excludedUnknownTiers += 1;
      continue;
    }
    items.push(item);
  }

  return { items, excludedUnknownTiers };
}

export function findItemByName(targetName) {
  return ITEM_NAME_INDEX.get(normalizeText(targetName)) ?? null;
}

function weightIncrease(passiveSet, item) {
  let total = 0;
  for (const [passiveId, { increase, match }] of Object.entries(WEIGHT_INCREASES)) {
    if (passiveSet.has(passiveId) && match(item)) {
      total += increase;
    }
  }
  return total;
}

function attributeMultiplier(passiveSet, item) {
  let multiplier = 1;

  if (item.hasStrengthRequirement) {
    if (passiveSet.has("a2")) {
      multiplier *= 4;
    }
    if (passiveSet.has("a1")) {
      multiplier *= 0.15;
    }
  }

  if (item.hasDexterityRequirement) {
    if (passiveSet.has("a5")) {
      multiplier *= 4;
    }
    if (passiveSet.has("a6")) {
      multiplier *= 0.15;
    }
  }

  if (item.hasIntelligenceRequirement) {
    if (passiveSet.has("a4")) {
      multiplier *= 4;
    }
    if (passiveSet.has("a3")) {
      multiplier *= 0.15;
    }
  }

  return multiplier;
}

function singleRollDistribution(items, passives) {
  const passiveSet = new Set(passives);
  const weights = new Map();
  let totalWeight = 0;

  for (const item of items) {
    const weight = (1 / TIER_COEFFICIENTS[item.tier]) * (1 + weightIncrease(passiveSet, item)) * attributeMultiplier(passiveSet, item);
    weights.set(item.name, weight);
    totalWeight += weight;
  }

  if (totalWeight <= 0) {
    throw new Error("The selected passives produced a zero-weight item pool.");
  }

  return new Map([...weights.entries()].map(([name, weight]) => [name, weight / totalWeight]));
}

function applyRecessiveGenes(items, distribution) {
  const rankMass = new Map();
  for (const item of items) {
    const rarityRank = RARITY_RANKS[item.tier];
    rankMass.set(rarityRank, (rankMass.get(rarityRank) ?? 0) + (distribution.get(item.name) ?? 0));
  }

  const commonerMassByRank = new Map();
  let cumulative = 0;
  for (const rank of [...rankMass.keys()].sort((left, right) => left - right)) {
    commonerMassByRank.set(rank, cumulative);
    cumulative += rankMass.get(rank) ?? 0;
  }

  const finalDistribution = new Map();
  let total = 0;
  for (const item of items) {
    const rarityRank = RARITY_RANKS[item.tier];
    const probability = distribution.get(item.name) ?? 0;
    const sameRankMass = rankMass.get(rarityRank) ?? 0;
    const commonerMass = commonerMassByRank.get(rarityRank) ?? 0;
    const value = probability * (2 * commonerMass + sameRankMass);
    finalDistribution.set(item.name, value);
    total += value;
  }

  return new Map([...finalDistribution.entries()].map(([name, probability]) => [name, probability / total]));
}

function expectedItemsPerWombgift(baseItems, passives) {
  const passiveSet = new Set(passives);
  let expectedItems = baseItems;
  for (const passiveId of SMALL_ADDITIONAL_ITEM_PASSIVES) {
    if (passiveSet.has(passiveId)) {
      expectedItems += 0.1;
    }
  }
  if (passiveSet.has("E")) {
    expectedItems += 0.3;
  }
  return expectedItems;
}

function foulbornRate(baseRate, passives) {
  const passiveSet = new Set(passives);
  if ([...FOULBORN_ZERO_PASSIVES].some((passiveId) => passiveSet.has(passiveId))) {
    return 0;
  }

  let multiplier = 1;
  for (const [passiveId, increase] of Object.entries(FOULBORN_INCREASES)) {
    if (passiveSet.has(passiveId)) {
      multiplier += increase;
    }
  }

  return Math.min(baseRate * multiplier, 1);
}

function targetProbability(item, distribution, variant, selectedFoulbornRate) {
  const family = variantFamily(variant);
  const probability = distribution.get(item.name) ?? 0;
  if (family === "any") {
    return probability;
  }
  if (!item.hasFoulbornVariant) {
    return family === "normal" ? probability : 0;
  }
  if (family === "normal") {
    return probability * (1 - selectedFoulbornRate);
  }
  return probability * selectedFoulbornRate;
}

export function buildEvaluationContext(items, target, variant, baseItems, baseFoulbornRate) {
  const baselineRollDistribution = singleRollDistribution(items, []);
  const baselineExpectedItems = expectedItemsPerWombgift(baseItems, []);
  const baselineFoulbornRate = foulbornRate(baseFoulbornRate, []);
  const baselineTargetRollProbability = targetProbability(target, baselineRollDistribution, variant, baselineFoulbornRate);
  const baselineExpectedRate = baselineExpectedItems * baselineTargetRollProbability;

  if (baselineExpectedRate === 0) {
    throw new Error("The baseline expected rate is zero, so a relative comparison cannot be computed.");
  }

  return {
    items,
    target,
    variant,
    baseItems,
    baseFoulbornRate,
    baselineExpectedItems,
    baselineFoulbornRate,
    baselineTargetRollProbability,
    baselineExpectedRate,
  };
}

export function evaluatePassives(context, passives) {
  let selectedRollDistribution = singleRollDistribution(context.items, passives);
  if (passives.includes("M")) {
    selectedRollDistribution = applyRecessiveGenes(context.items, selectedRollDistribution);
  }

  const selectedExpectedItems = expectedItemsPerWombgift(context.baseItems, passives);
  const selectedFoulbornRate = foulbornRate(context.baseFoulbornRate, passives);
  const selectedTargetRollProbability = targetProbability(
    context.target,
    selectedRollDistribution,
    context.variant,
    selectedFoulbornRate
  );
  const selectedExpectedRate = selectedExpectedItems * selectedTargetRollProbability;

  return {
    passives,
    selectedTargetRollProbability,
    selectedExpectedItems,
    selectedFoulbornRate,
    selectedExpectedRate,
    relativeRate: selectedExpectedRate / context.baselineExpectedRate,
  };
}

export function sortPassives(passives) {
  const selected = new Set(passives);
  return TREE_NODE_IDS.filter((passiveId) => selected.has(passiveId));
}

export function validatePassives(passives, variant = "any") {
  const selected = new Set(passives);
  const unsupported = passives.filter((passiveId) => UNSUPPORTED_PASSIVES.has(passiveId));
  if (unsupported.length > 0) {
    throw new Error(`Breach-specific passives are not supported: ${unsupported.join(", ")}.`);
  }

  for (const passiveId of passives) {
    const parent = TREE_PARENTS[passiveId];
    if (!parent) {
      throw new Error(`Passive '${passiveId}' is not mapped in the modeled Genesis Tree topology.`);
    }
    if (parent !== ROOT_NODE && !selected.has(parent)) {
      throw new Error(`Passive '${passiveId}' requires '${parent}' to be allocated first.`);
    }
  }

  for (const passiveId of forbiddenVariantPassives(variant)) {
    if (selected.has(passiveId)) {
      throw new Error(`Passive '${passiveId}' cannot be used while ${describeVariant(variant)} is selected.`);
    }
  }

  for (const passiveId of requiredVariantPassives(variant)) {
    if (!selected.has(passiveId)) {
      throw new Error(`Passive '${passiveId}' is required while ${describeVariant(variant)} is selected.`);
    }
  }
}

function targetHasAttributeRequirement(item, attribute) {
  if (attribute === "strength") {
    return item.hasStrengthRequirement;
  }
  if (attribute === "dexterity") {
    return item.hasDexterityRequirement;
  }
  return item.hasIntelligenceRequirement;
}

function passiveCanImproveTarget(context, passiveId) {
  const family = variantFamily(context.variant);
  if (SMALL_ADDITIONAL_ITEM_PASSIVES.has(passiveId) || passiveId === "E" || passiveId === "M") {
    return true;
  }
  if (passiveId in WEIGHT_INCREASES) {
    return WEIGHT_INCREASES[passiveId].match(context.target);
  }
  if (passiveId in ATTRIBUTE_MORE) {
    return targetHasAttributeRequirement(context.target, ATTRIBUTE_MORE[passiveId]);
  }
  if (passiveId in ATTRIBUTE_LESS) {
    return !targetHasAttributeRequirement(context.target, ATTRIBUTE_LESS[passiveId]);
  }
  if (passiveId === "A") {
    return family === "normal" && context.target.hasFoulbornVariant;
  }
  if (passiveId === "L") {
    return family === "foulborn" && context.target.hasFoulbornVariant;
  }
  return false;
}

function optimizerCandidatePassives(context, exactPoints) {
  const forbidden = new Set(forbiddenVariantPassives(context.variant));
  const supported = new Set(SUPPORTED_TREE_NODE_IDS.filter((passiveId) => !forbidden.has(passiveId)));
  for (const passiveId of REQUIRED_BEST_TREE_PASSIVES) {
    supported.add(passiveId);
  }
  for (const passiveId of requiredVariantPassives(context.variant)) {
    for (const ancestorId of pathToNode(passiveId)) {
      if (PASSIVES[ancestorId]?.supported && !forbidden.has(ancestorId)) {
        supported.add(ancestorId);
      }
    }
  }
  if (exactPoints) {
    return supported;
  }

  const allowed = new Set([...supported].filter((passiveId) => passiveCanImproveTarget(context, passiveId)));
  for (const passiveId of REQUIRED_BEST_TREE_PASSIVES) {
    allowed.add(passiveId);
  }
  for (const passiveId of requiredVariantPassives(context.variant)) {
    for (const ancestorId of pathToNode(passiveId)) {
      if (PASSIVES[ancestorId]?.supported && !forbidden.has(ancestorId)) {
        allowed.add(ancestorId);
      }
    }
  }
  for (const passiveId of [...allowed]) {
    let parent = TREE_PARENTS[passiveId];
    while (parent && parent !== ROOT_NODE) {
      allowed.add(parent);
      parent = TREE_PARENTS[parent];
    }
  }
  return allowed;
}

function buildExactCandidatePassives(context, maxPoints, seedPassives) {
  const allowed = optimizerCandidatePassives(context, false);
  const forbidden = new Set(forbiddenVariantPassives(context.variant));

  for (const passiveId of seedPassives) {
    for (const ancestorId of pathToNode(passiveId)) {
      if (PASSIVES[ancestorId]?.supported) {
        allowed.add(ancestorId);
      }
    }
  }

  for (const passiveId of SUPPORTED_TREE_NODE_IDS) {
    if (!PASSIVES[passiveId].affectsRate) {
      for (const ancestorId of pathToNode(passiveId)) {
        if (PASSIVES[ancestorId]?.supported) {
          allowed.add(ancestorId);
        }
      }
    }
  }

  const targetCandidateCount = Math.min(
    SUPPORTED_TREE_NODE_IDS.length,
    Math.max(maxPoints + EXACT_CANDIDATE_SLACK, allowed.size)
  );
  if (allowed.size >= targetCandidateCount) {
    return allowed;
  }

  const rankedFillers = SUPPORTED_TREE_NODE_IDS
    .filter((passiveId) => !allowed.has(passiveId) && !forbidden.has(passiveId))
    .map((passiveId) => {
      const path = addPassivePath([], passiveId);
      const relativeRate = evaluatePassives(context, path).relativeRate;
      const additionalPathCost = path.filter((pathPassiveId) => !allowed.has(pathPassiveId)).length;
      return {
        passiveId,
        relativeRate,
        additionalPathCost,
      };
    })
    .sort((left, right) => {
      if (Math.abs(left.relativeRate - right.relativeRate) > 1e-12) {
        return right.relativeRate - left.relativeRate;
      }
      if (left.additionalPathCost !== right.additionalPathCost) {
        return left.additionalPathCost - right.additionalPathCost;
      }
      return left.passiveId.localeCompare(right.passiveId);
    });

  for (const { passiveId } of rankedFillers) {
    for (const ancestorId of pathToNode(passiveId)) {
      if (PASSIVES[ancestorId]?.supported) {
        allowed.add(ancestorId);
      }
    }
    if (allowed.size >= targetCandidateCount) {
      break;
    }
  }

  return allowed;
}

function generateValidAllocations(maxPoints, allowed) {
  const cache = new Map();

  function rootedOptions(nodeId, budget) {
    const cacheKey = `${nodeId}:${budget}`;
    if (cache.has(cacheKey)) {
      return cache.get(cacheKey);
    }
    if (budget < 1 || !allowed.has(nodeId)) {
      cache.set(cacheKey, []);
      return [];
    }

    let options = new Map([[1, [[nodeId]]]]);
    for (const childId of TREE_CHILDREN[nodeId] ?? []) {
      const childOptions = new Map([[0, [[]]]]);
      for (const [size, allocations] of rootedOptions(childId, budget - 1)) {
        childOptions.set(size, allocations);
      }

      const nextOptions = new Map();
      for (const [currentSize, currentAllocations] of options) {
        for (const [childSize, childAllocations] of childOptions) {
          const totalSize = currentSize + childSize;
          if (totalSize > budget) {
            continue;
          }
          const combined = nextOptions.get(totalSize) ?? [];
          for (const currentAllocation of currentAllocations) {
            for (const childAllocation of childAllocations) {
              combined.push([...currentAllocation, ...childAllocation]);
            }
          }
          nextOptions.set(totalSize, combined);
        }
      }
      options = nextOptions;
    }

    const result = [...options.entries()].sort((left, right) => left[0] - right[0]);
    cache.set(cacheKey, result);
    return result;
  }

  let options = new Map([[0, [[]]]]);
  for (const childId of REQUIRED_BEST_TREE_PASSIVES) {
    const childOptions = new Map(rootedOptions(childId, maxPoints));
    const nextOptions = new Map();
    for (const [currentSize, currentAllocations] of options) {
      for (const [childSize, childAllocations] of childOptions) {
        const totalSize = currentSize + childSize;
        if (totalSize > maxPoints) {
          continue;
        }
        const combined = nextOptions.get(totalSize) ?? [];
        for (const currentAllocation of currentAllocations) {
          for (const childAllocation of childAllocations) {
            combined.push(sortPassives([...currentAllocation, ...childAllocation]));
          }
        }
        nextOptions.set(totalSize, combined);
      }
    }
    options = nextOptions;
  }

  return new Map([...options.entries()].sort((left, right) => left[0] - right[0]));
}

function chooseBestAllocationFromAllowed(context, maxPoints, exactPoints, allowed) {
  const allocationsBySize = generateValidAllocations(maxPoints, allowed);
  const candidateSizes = exactPoints ? [maxPoints] : [...allocationsBySize.keys()].sort((left, right) => left - right);

  let bestResult = null;
  let bestSize = 0;
  let evaluatedCount = 0;

  for (const size of candidateSizes) {
    for (const allocation of allocationsBySize.get(size) ?? []) {
      if (!allocationMatchesVariantConstraints(context.variant, allocation)) {
        continue;
      }

      evaluatedCount += 1;
      const result = evaluatePassives(context, allocation);
      if (!bestResult) {
        bestResult = result;
        bestSize = size;
        continue;
      }

      if (result.relativeRate > bestResult.relativeRate + 1e-12) {
        bestResult = result;
        bestSize = size;
        continue;
      }

      if (Math.abs(result.relativeRate - bestResult.relativeRate) <= 1e-12) {
        const currentOrder = allocation.join("|");
        const bestOrder = bestResult.passives.join("|");
        if (size < bestSize || (size === bestSize && currentOrder < bestOrder)) {
          bestResult = result;
          bestSize = size;
        }
      }
    }
  }

  if (!bestResult) {
    throw new Error("No valid tree allocations were found for the requested point budget.");
  }

  return {
    result: bestResult,
    usedPoints: bestSize,
    evaluatedCount,
  };
}

export function chooseBestAllocation(context, maxPoints, exactPoints) {
  if (!exactPoints) {
    return chooseBestAllocationFromAllowed(context, maxPoints, false, optimizerCandidatePassives(context, false));
  }

  const relaxedBest = chooseBestAllocationFromAllowed(context, maxPoints, false, optimizerCandidatePassives(context, false));
  const exactAllowed = buildExactCandidatePassives(context, maxPoints, relaxedBest.result.passives);
  return chooseBestAllocationFromAllowed(context, maxPoints, true, exactAllowed);
}

export function pathToNode(nodeId) {
  const path = [];
  let current = nodeId;
  while (current && current !== ROOT_NODE) {
    path.unshift(current);
    current = TREE_PARENTS[current];
  }
  return path;
}

export function collectSubtree(nodeId) {
  const nodes = [];
  function visit(current) {
    nodes.push(current);
    for (const childId of TREE_CHILDREN[current] ?? []) {
      visit(childId);
    }
  }
  visit(nodeId);
  return nodes;
}

export function addPassivePath(passives, nodeId) {
  if (!PASSIVES[nodeId]?.supported) {
    return sortPassives(passives);
  }

  const next = new Set(passives);
  for (const ancestorId of pathToNode(nodeId)) {
    if (PASSIVES[ancestorId]?.supported) {
      next.add(ancestorId);
    }
  }
  return sortPassives([...next]);
}

export function removePassiveBranch(passives, nodeId) {
  if (!PASSIVES[nodeId]?.supported) {
    return sortPassives(passives);
  }

  const next = new Set(passives);
  for (const descendantId of collectSubtree(nodeId)) {
    next.delete(descendantId);
  }
  return sortPassives([...next]);
}

export function passiveDebugMultiplier(context, passives, nodeId) {
  if (!PASSIVES[nodeId]?.supported) {
    return null;
  }

  const currentPassives = sortPassives(passives);
  const withoutNode = removePassiveBranch(currentPassives, nodeId);
  const withNode = addPassivePath(withoutNode, nodeId);
  const withNodeResult = evaluatePassives(context, withNode);
  const withoutNodeResult = evaluatePassives(context, withoutNode);

  return {
    multiplier: withNodeResult.relativeRate / withoutNodeResult.relativeRate,
    withNodeResult,
    withoutNodeResult,
  };
}

export function toggleManualPassive(passives, nodeId) {
  if (!PASSIVES[nodeId]?.supported) {
    return sortPassives(passives);
  }

  if (passives.includes(nodeId)) {
    return removePassiveBranch(passives, nodeId);
  }

  return addPassivePath(passives, nodeId);
}