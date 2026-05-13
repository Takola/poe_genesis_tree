import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import treeImageUrl from "./assets/genesis-tree-screenshot.png";
import {
  DEFAULT_BASE_FOULBORN_RATE,
  DEFAULT_BASE_ITEMS,
  NODE_LAYOUT,
  PASSIVES,
  TREE_CHILDREN,
  TREE_NODE_IDS,
  attributeLabel,
  buildEvaluationContext,
  chooseBestAllocation,
  describeVariant,
  evaluatePassives,
  filterEligibleItems,
  findItemByName,
  formatPercent,
  formatRatio,
  formatValue,
  normalizeText,
  passiveDebugMultiplier,
  searchItems,
  sortPassives,
  tierLabel,
  toggleManualPassive,
  validatePassives,
  variantNeedsFoulbornTarget,
} from "./lib/genesis-engine.js";

const DEFAULT_TARGET = "Headhunter";
const MIN_WOMBGIFT_LEVEL = 68;
const MAX_WOMBGIFT_LEVEL = 80;
const DEFAULT_LEVEL_CAP = MAX_WOMBGIFT_LEVEL;
const MIN_POINT_BUDGET = 10;
const DEFAULT_POINT_BUDGET = 13;
const MAX_POINT_BUDGET = 13;
const TREE_IMAGE_WIDTH = 2110;
const TREE_IMAGE_HEIGHT = 941;
const DEFAULT_NODE_RADIUS = 12;
const MIN_NODE_RADIUS = 4;
const MAX_NODE_RADIUS = 48;
const LARGE_NODE_RADIUS = 45;
const REPOSITORY_NAME = "poe_genesis_tree";
const GITHUB_SEARCH_FALLBACK_URL = `https://github.com/search?q=${encodeURIComponent(REPOSITORY_NAME)}&type=repositories`;
const INTEGER_FORMATTER = new Intl.NumberFormat("en-US");
const ONE_DECIMAL_FORMATTER = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
const HIVEBLOOD_COST_ANCHORS = [
  { level: 68, cost: 100 },
  { level: 75, cost: 425 },
  { level: 80, cost: 900 },
  { level: 83, cost: 1100 },
  { level: 84, cost: 1300 },
];

function clampNumber(value, minimum, maximum, fallback) {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  return Math.min(Math.max(parsed, minimum), maximum);
}

function roundToStep(value, step) {
  return Math.round(value / step) * step;
}

function metricValue(value, fallback = "-") {
  return value ?? fallback;
}

function displayLevelCap(levelCap) {
  return levelCap >= MAX_WOMBGIFT_LEVEL ? "80+" : String(levelCap);
}

function shouldShowDebugMultiplier(nodeId) {
  return PASSIVES[nodeId]?.supported;
}

function formatCount(value) {
  if (!Number.isFinite(value)) {
    return "∞";
  }
  return INTEGER_FORMATTER.format(Math.round(value));
}

function estimateHivebloodPerWombgift(levelCap) {
  const referenceLevel = levelCap >= MAX_WOMBGIFT_LEVEL ? 84 : Math.round(levelCap);

  for (let index = 0; index < HIVEBLOOD_COST_ANCHORS.length; index += 1) {
    const currentAnchor = HIVEBLOOD_COST_ANCHORS[index];
    const nextAnchor = HIVEBLOOD_COST_ANCHORS[index + 1];

    if (!nextAnchor || referenceLevel <= currentAnchor.level) {
      return currentAnchor.cost;
    }

    if (referenceLevel <= nextAnchor.level) {
      const progress = (referenceLevel - currentAnchor.level) / (nextAnchor.level - currentAnchor.level);
      return roundToStep(currentAnchor.cost + (nextAnchor.cost - currentAnchor.cost) * progress, 25);
    }
  }

  return HIVEBLOOD_COST_ANCHORS.at(-1)?.cost ?? 1300;
}

function resolveVariant(baseVariant, needsMultipleFoulborn, avoidCorruptedNonFoulborn) {
  if (baseVariant === "foulborn" && needsMultipleFoulborn && avoidCorruptedNonFoulborn) {
    return "foulbornForceKAvoidL";
  }
  if (baseVariant === "foulborn" && needsMultipleFoulborn) {
    return "foulbornForceK";
  }
  if (baseVariant === "foulborn" && avoidCorruptedNonFoulborn) {
    return "foulbornAvoidL";
  }
  return baseVariant;
}

function roundLayoutValue(value) {
  return Math.round(value * 10) / 10;
}

function formatLayoutValue(value) {
  return roundLayoutValue(value).toFixed(1);
}

function createCalibrationLayout() {
  return Object.fromEntries(
    TREE_NODE_IDS.map((nodeId) => {
      const position = NODE_LAYOUT[nodeId] ?? {};
      return [
        nodeId,
        {
          x: roundLayoutValue(position.x ?? 0),
          y: roundLayoutValue(position.y ?? 0),
          radius: roundLayoutValue(position.radius ?? DEFAULT_NODE_RADIUS),
        },
      ];
    })
  );
}

function serializeNodeLayout(layout) {
  return [
    "export const NODE_LAYOUT = {",
    ...TREE_NODE_IDS.map((nodeId) => {
      const position = layout[nodeId] ?? {};
      return `  ${nodeId}: { x: ${formatLayoutValue(position.x ?? 0)}, y: ${formatLayoutValue(position.y ?? 0)}, radius: ${formatLayoutValue(position.radius ?? DEFAULT_NODE_RADIUS)} },`;
    }),
    "};",
  ].join("\n");
}

function nodeLayoutStyle(position = {}) {
  const radius = position.radius ?? DEFAULT_NODE_RADIUS;

  return {
    left: `${((position.x ?? 0) / TREE_IMAGE_WIDTH) * 100}%`,
    top: `${((position.y ?? 0) / TREE_IMAGE_HEIGHT) * 100}%`,
    width: `${((radius * 2) / TREE_IMAGE_WIDTH) * 100}%`,
    height: `${((radius * 2) / TREE_IMAGE_HEIGHT) * 100}%`,
  };
}

function defaultBaseFoulbornPercentText() {
  return (DEFAULT_BASE_FOULBORN_RATE * 100).toString();
}

function resolveRepositoryUrl() {
  if (typeof window === "undefined") {
    return GITHUB_SEARCH_FALLBACK_URL;
  }

  const { hostname, pathname } = window.location;
  if (!hostname.endsWith(".github.io")) {
    return GITHUB_SEARCH_FALLBACK_URL;
  }

  const owner = hostname.slice(0, -".github.io".length);
  const [repoFromPath] = pathname.split("/").filter(Boolean);
  const repo = repoFromPath || REPOSITORY_NAME;
  if (!owner || !repo) {
    return GITHUB_SEARCH_FALLBACK_URL;
  }

  return `https://github.com/${owner}/${repo}`;
}

export default function App() {
  const treeBoardRef = useRef(null);
  const [workspaceView, setWorkspaceView] = useState("calculator");
  const [targetInput, setTargetInput] = useState(DEFAULT_TARGET);
  const [mode, setMode] = useState("best");
  const [variantSelection, setVariantSelection] = useState("any");
  const [appliedVariantSelection, setAppliedVariantSelection] = useState("any");
  const [needsMultipleFoulborn, setNeedsMultipleFoulborn] = useState(false);
  const [appliedNeedsMultipleFoulborn, setAppliedNeedsMultipleFoulborn] = useState(false);
  const [avoidCorruptedNonFoulborn, setAvoidCorruptedNonFoulborn] = useState(false);
  const [appliedAvoidCorruptedNonFoulborn, setAppliedAvoidCorruptedNonFoulborn] = useState(false);
  const [levelCap, setLevelCap] = useState(DEFAULT_LEVEL_CAP);
  const [appliedLevelCap, setAppliedLevelCap] = useState(DEFAULT_LEVEL_CAP);
  const [pointBudget, setPointBudget] = useState(DEFAULT_POINT_BUDGET);
  const [appliedPointBudget, setAppliedPointBudget] = useState(DEFAULT_POINT_BUDGET);
  const [debugMode, setDebugMode] = useState(false);
  const [debugMultiplierMode, setDebugMultiplierMode] = useState("cumulative");
  const [baseItems, setBaseItems] = useState(DEFAULT_BASE_ITEMS.toString());
  const [baseFoulbornPercent, setBaseFoulbornPercent] = useState(defaultBaseFoulbornPercentText());
  const [manualPassives, setManualPassives] = useState([]);
  const [treeMessage, setTreeMessage] = useState("");
  const [calibrationLayout, setCalibrationLayout] = useState(() => createCalibrationLayout());
  const [selectedCalibrationNode, setSelectedCalibrationNode] = useState(TREE_NODE_IDS[0]);
  const [calibrationMessage, setCalibrationMessage] = useState(
    "Select a node, then click the tree screenshot to place its center."
  );

  const deferredTargetInput = useDeferredValue(targetInput);
  const suggestions = searchItems(deferredTargetInput, 12);

  const normalizedTargetInput = normalizeText(targetInput);
  const catalogTarget = findItemByName(targetInput);
  const unsupportedTargetSelected = catalogTarget?.dropPool === "breach-only";
  const treeStatusMessage = unsupportedTargetSelected ? "Not supported" : treeMessage;
  const repositoryUrl = useMemo(() => resolveRepositoryUrl(), []);
  const appliedVariant = useMemo(
    () => resolveVariant(
      appliedVariantSelection,
      appliedNeedsMultipleFoulborn,
      appliedAvoidCorruptedNonFoulborn
    ),
    [appliedVariantSelection, appliedNeedsMultipleFoulborn, appliedAvoidCorruptedNonFoulborn]
  );
  
  const parsedLevelCap = Math.round(
    clampNumber(appliedLevelCap, MIN_WOMBGIFT_LEVEL, MAX_WOMBGIFT_LEVEL, DEFAULT_LEVEL_CAP)
  );
  const effectiveLevelCap = parsedLevelCap >= MAX_WOMBGIFT_LEVEL ? Number.POSITIVE_INFINITY : parsedLevelCap;
  
  const sliderLevelCap = Math.round(clampNumber(levelCap, MIN_WOMBGIFT_LEVEL, MAX_WOMBGIFT_LEVEL, DEFAULT_LEVEL_CAP));
  const levelCapLabel = displayLevelCap(sliderLevelCap);
  const appliedLevelCapLabel = displayLevelCap(parsedLevelCap);

  const parsedPointBudget = Math.round(
    clampNumber(appliedPointBudget, MIN_POINT_BUDGET, MAX_POINT_BUDGET, DEFAULT_POINT_BUDGET)
  );
  const sliderPointBudget = Math.round(clampNumber(pointBudget, MIN_POINT_BUDGET, MAX_POINT_BUDGET, DEFAULT_POINT_BUDGET));

  const parsedBaseItems = clampNumber(baseItems, 0.01, 10, DEFAULT_BASE_ITEMS);
  const parsedBaseFoulbornRate = clampNumber(baseFoulbornPercent, 0, 100, DEFAULT_BASE_FOULBORN_RATE * 100) / 100;
  const estimatedHivebloodPerGift = useMemo(() => estimateHivebloodPerWombgift(parsedLevelCap), [parsedLevelCap]);
  const hivebloodPerGift = estimatedHivebloodPerGift;

  const { items: eligibleItems } = useMemo(() => filterEligibleItems(effectiveLevelCap), [effectiveLevelCap]);
  const eligibleTarget = useMemo(
    () => eligibleItems.find((item) => normalizeText(item.name) === normalizedTargetInput) ?? null,
    [eligibleItems, normalizedTargetInput]
  );

  // Keep the optimizer off the render hot path so draft control changes stay responsive.
  const { scenario, scenarioError } = useMemo(() => {
    let nextScenario = null;
    let nextScenarioError = "";

    if (!catalogTarget) {
      nextScenarioError = "Choose an exact unique from the suggestion list to start calculating.";
    } else if (catalogTarget.dropPool === "breach-only") {
      nextScenarioError = "Not supported.";
    } else if (!eligibleTarget) {
      nextScenarioError = `${catalogTarget.name} is not eligible at Ancient Wombgift level ${appliedLevelCapLabel}.`;
    } else if (variantNeedsFoulbornTarget(appliedVariant) && !eligibleTarget.hasFoulbornVariant) {
      nextScenarioError = `${eligibleTarget.name} does not have a foulborn variant in the modeled pool.`;
    } else {
      try {
        const context = buildEvaluationContext(
          eligibleItems,
          eligibleTarget,
          appliedVariant,
          parsedBaseItems,
          parsedBaseFoulbornRate
        );

        if (mode === "best") {
          const best = chooseBestAllocation(context, parsedPointBudget, true);
          nextScenario = {
            mode,
            context,
            result: best.result,
            usedPoints: best.usedPoints,
            evaluatedCount: best.evaluatedCount,
          };
        } else {
          const passives = sortPassives(manualPassives);
          validatePassives(passives, appliedVariant);
          nextScenario = {
            mode,
            context,
            result: evaluatePassives(context, passives),
            usedPoints: passives.length,
            evaluatedCount: null,
          };
        }
      } catch (error) {
        nextScenarioError = error instanceof Error ? error.message : "Calculation failed.";
      }
    }

    return { scenario: nextScenario, scenarioError: nextScenarioError };
  }, [
    appliedLevelCapLabel,
    appliedVariant,
    catalogTarget,
    eligibleItems,
    eligibleTarget,
    manualPassives,
    mode,
    parsedBaseFoulbornRate,
    parsedBaseItems,
    parsedPointBudget,
  ]);

  const activePassives = useMemo(
    () => scenario?.result.passives ?? (mode === "manual" ? manualPassives : []),
    [manualPassives, mode, scenario]
  );

  useEffect(() => {
    if (!treeMessage) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setTreeMessage("");
    }, 5000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [treeMessage]);

  const debugNodeMultipliers = useMemo(() => {
    const multipliers = new Map();

    if (!debugMode || !scenario) {
      return multipliers;
    }

    for (const nodeId of TREE_NODE_IDS) {
      if (!shouldShowDebugMultiplier(nodeId)) {
        continue;
      }

      const details = passiveDebugMultiplier(scenario.context, activePassives, nodeId, debugMultiplierMode);
      if (!details) {
        multipliers.set(nodeId, { label: "n/a", tone: "is-unsupported" });
        continue;
      }

      const { multiplier } = details;
      const tone = multiplier > 1 + 1e-4 ? "is-positive" : multiplier < 1 - 1e-4 ? "is-negative" : "is-neutral";
      multipliers.set(nodeId, { label: `${formatValue(multiplier)}x`, tone });
    }

    return multipliers;
  }, [activePassives, debugMode, debugMultiplierMode, scenario]);
  const dropRatePerWombgift = scenario?.result.selectedExpectedRate ?? null;
  const wombgiftsPerTargetDrop = useMemo(() => {
    if (!dropRatePerWombgift && dropRatePerWombgift !== 0) {
      return null;
    }
    if (dropRatePerWombgift <= 0) {
      return Number.POSITIVE_INFINITY;
    }
    return 1 / dropRatePerWombgift;
  }, [dropRatePerWombgift]);
  const hivebloodCostPerTargetDrop = useMemo(() => {
    if (wombgiftsPerTargetDrop == null) {
      return null;
    }
    return wombgiftsPerTargetDrop * hivebloodPerGift;
  }, [hivebloodPerGift, wombgiftsPerTargetDrop]);

  const selectedCalibrationPosition = calibrationLayout[selectedCalibrationNode] ?? {
    x: 0,
    y: 0,
    radius: DEFAULT_NODE_RADIUS,
  };
  const calibrationExport = serializeNodeLayout(calibrationLayout);

  function updateCalibrationNode(nodeId, updates) {
    setCalibrationLayout((currentLayout) => ({
      ...currentLayout,
      [nodeId]: {
        ...currentLayout[nodeId],
        ...updates,
      },
    }));
  }

  function selectCalibrationNode(nodeId) {
    setSelectedCalibrationNode(nodeId);
    setCalibrationMessage(`${nodeId} selected. Click the screenshot to update its center.`);
  }

  function handleCalibrationBoardClick(event) {
    if (!treeBoardRef.current) {
      return;
    }

    const rect = treeBoardRef.current.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      return;
    }

    const x = roundLayoutValue(
      clampNumber(((event.clientX - rect.left) / rect.width) * TREE_IMAGE_WIDTH, 0, TREE_IMAGE_WIDTH, 0)
    );
    const y = roundLayoutValue(
      clampNumber(((event.clientY - rect.top) / rect.height) * TREE_IMAGE_HEIGHT, 0, TREE_IMAGE_HEIGHT, 0)
    );

    updateCalibrationNode(selectedCalibrationNode, { x, y });
    setCalibrationMessage(
      `${selectedCalibrationNode} center set to (${formatLayoutValue(x)}, ${formatLayoutValue(y)}).`
    );
  }

  function handleCalibrationRadiusChange(event) {
    const radius = roundLayoutValue(
      clampNumber(event.target.value, MIN_NODE_RADIUS, MAX_NODE_RADIUS, DEFAULT_NODE_RADIUS)
    );

    updateCalibrationNode(selectedCalibrationNode, { radius });
    setCalibrationMessage(`${selectedCalibrationNode} radius set to ${formatLayoutValue(radius)} px.`);
  }

  async function handleCalibrationCopy() {
    try {
      await navigator.clipboard.writeText(calibrationExport);
      setCalibrationMessage("Copied the current NODE_LAYOUT snippet to the clipboard.");
    } catch {
      setCalibrationMessage("Clipboard copy was blocked. Use the export box below to copy the layout manually.");
    }
  }

  function handleCalibrationReset() {
    setCalibrationLayout(createCalibrationLayout());
    setSelectedCalibrationNode(TREE_NODE_IDS[0]);
    setCalibrationMessage("Calibration draft reset to the current NODE_LAYOUT values.");
  }

  function handleAdvanceCalibrationNode() {
    const currentIndex = TREE_NODE_IDS.indexOf(selectedCalibrationNode);
    const nextNodeId = TREE_NODE_IDS[(currentIndex + 1) % TREE_NODE_IDS.length];
    selectCalibrationNode(nextNodeId);
  }

  function handleNodeClick(nodeId) {
    if (mode !== "manual") {
      return;
    }

    if (!PASSIVES[nodeId].supported) {
      setTreeMessage(`${nodeId} is not supported.`);
      return;
    }

    setManualPassives((currentPassives) => toggleManualPassive(currentPassives, nodeId));
    setTreeMessage(`${nodeId} updated. Parents auto-fill and removing a node also removes its descendants.`);
  }

  function handleDebugModeToggle() {
    setDebugMode((current) => !current);
    setBaseItems(DEFAULT_BASE_ITEMS.toString());
    setBaseFoulbornPercent(defaultBaseFoulbornPercentText());
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <header className="sidebar-header fade-up">
          <h1>Genesis Tree</h1>
          <p>Static Web Calculator</p>

          <div className="view-switch segmented-control segmented-control--view" role="tablist" aria-label="Workspace views">
            <button
              type="button"
              className={workspaceView === "calculator" ? "is-active" : ""}
              onClick={() => setWorkspaceView("calculator")}
              aria-selected={workspaceView === "calculator"}
            >
              Calculator
            </button>
            <button
              type="button"
              className={workspaceView === "readme" ? "is-active" : ""}
              onClick={() => setWorkspaceView("readme")}
              aria-selected={workspaceView === "readme"}
            >
              README
            </button>
          </div>
        </header>

        <div className="sidebar-content">
          {workspaceView === "calculator" ? (
            <>
              <section className="panel-card fade-up" style={{ animationDelay: "90ms" }}>
                <div className="panel-head">
                  <h2>Select Target</h2>
                </div>
                <input
                  id="target-input"
                  className="text-input"
                  value={targetInput}
                  onChange={(event) => setTargetInput(event.target.value)}
                  placeholder="Search exact unique name..."
                  autoComplete="off"
                  spellCheck="false"
                />
                {suggestions.length > 0 && (
                  <div className="suggestion-list" role="listbox">
                    {suggestions.map((item) => (
                      <button
                        key={item.name}
                        type="button"
                        className={`suggestion-chip ${item.name === targetInput ? "is-active" : ""}`}
                        onClick={() => setTargetInput(item.name)}
                      >
                        <span>{item.name}</span>
                      </button>
                    ))}
                  </div>
                )}

                <div className="target-summary">
                  <div><span>Target</span><strong>{catalogTarget?.name ?? "-"}</strong></div>
                  <div><span>Tier</span><strong>{catalogTarget ? `T${tierLabel(catalogTarget)}` : "-"}</strong></div>
                  <div><span>Req</span><strong>{catalogTarget ? attributeLabel(catalogTarget) : "-"}</strong></div>
                  <div><span>Foulborn</span><strong>{catalogTarget?.hasFoulbornVariant ? "Yes" : "No"}</strong></div>
                </div>
              </section>

              <section className="panel-card fade-up" style={{ animationDelay: "150ms" }}>
                <div className="panel-head panel-head--split">
                  <h2>Options</h2>
                  <button
                    type="button"
                    className={`debug-toggle ${debugMode ? "is-active" : ""}`}
                    onClick={handleDebugModeToggle}
                  >
                    Debug
                  </button>
                </div>

                <div className="segmented-control">
                  <button type="button" className={mode === "best" ? "is-active" : ""} onClick={() => setMode("best")}>Optimizer</button>
                  <button type="button" className={mode === "manual" ? "is-active" : ""} onClick={() => setMode("manual")}>Manual</button>
                </div>

                <label className="field-label">Target Variant</label>
                <div className="segmented-control segmented-control--variants">
                  <button
                    type="button"
                    className={variantSelection === "normal" ? "is-active" : ""}
                    onClick={() => setVariantSelection("normal")}
                  >
                    Non-Foulborn
                  </button>
                  <button
                    type="button"
                    className={variantSelection === "any" ? "is-active" : ""}
                    onClick={() => setVariantSelection("any")}
                  >
                    Any
                  </button>
                  <button
                    type="button"
                    className={variantSelection === "foulborn" ? "is-active" : ""}
                    onClick={() => setVariantSelection("foulborn")}
                  >
                    Foulborn
                  </button>
                </div>

                {variantSelection === "foulborn" && (
                  <div className="option-checklist">
                    <label className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={needsMultipleFoulborn}
                        onChange={(event) => setNeedsMultipleFoulborn(event.target.checked)}
                      />
                      <span>
                        Need Multiple Foulborn
                        <small>Forces Extremely Foul (K) in optimizer results.</small>
                      </span>
                    </label>
                    <label className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={avoidCorruptedNonFoulborn}
                        onChange={(event) => setAvoidCorruptedNonFoulborn(event.target.checked)}
                      />
                      <span>
                        Avoid Corrupted Non-Foulborn
                        <small>Prevents Corrupted Flesh (L) from being chosen while still targeting foulborn outcomes.</small>
                      </span>
                    </label>
                  </div>
                )}

                <label className="field-label">Wombgift Level Cap: {levelCapLabel}</label>
                <input
                  className="range-slider"
                  type="range"
                  min={String(MIN_WOMBGIFT_LEVEL)}
                  max={String(MAX_WOMBGIFT_LEVEL)}
                  value={sliderLevelCap}
                  onChange={(event) => setLevelCap(event.target.value)}
                />

                {mode === "best" && (
                  <>
                    <label className="field-label">Point Budget: {sliderPointBudget}</label>
                    <input
                      className="range-slider"
                      type="range"
                      min={String(MIN_POINT_BUDGET)}
                      max={String(MAX_POINT_BUDGET)}
                      value={sliderPointBudget}
                      onChange={(event) => setPointBudget(event.target.value)}
                    />
                  </>
                )}

                <button
                  type="button"
                  className="calculate-button"
                  onClick={() => {
                    setAppliedVariantSelection(variantSelection);
                    setAppliedNeedsMultipleFoulborn(needsMultipleFoulborn);
                    setAppliedAvoidCorruptedNonFoulborn(avoidCorruptedNonFoulborn);
                    setAppliedLevelCap(levelCap);
                    setAppliedPointBudget(pointBudget);
                  }}
                >
                  Calculate
                </button>

                {debugMode && (
                  <>
                    <label className="field-label">Debug Multiplier Mode</label>
                    <div className="segmented-control" role="tablist" aria-label="Debug multiplier mode">
                      <button
                        type="button"
                        className={debugMultiplierMode === "cumulative" ? "is-active" : ""}
                        onClick={() => setDebugMultiplierMode("cumulative")}
                      >
                        Cumulative
                      </button>
                      <button
                        type="button"
                        className={debugMultiplierMode === "single" ? "is-active" : ""}
                        onClick={() => setDebugMultiplierMode("single")}
                      >
                        Single Node
                      </button>
                    </div>
                    <p className="field-note">
                      Cumulative includes the full missing path to a node. Single node isolates only that node after its required parents.
                    </p>
                    <div className="input-grid debug-grid">
                      <div>
                        <label className="field-label">Base Items</label>
                        <input className="text-input" type="number" step="0.01" value={baseItems} onChange={(e) => setBaseItems(e.target.value)} />
                      </div>
                      <div>
                        <label className="field-label">Base Foulborn %</label>
                        <input className="text-input" type="number" step="0.1" value={baseFoulbornPercent} onChange={(e) => setBaseFoulbornPercent(e.target.value)} />
                      </div>
                    </div>
                  </>
                )}
              </section>

              <section className="panel-card fade-up" style={{ animationDelay: "210ms" }}>
                <div className="panel-head">
                  <h2>Outcome</h2>
                </div>
                {scenario ? (
                  <>
                    <div className="metric-grid">
                      <div className="metric-card metric-card--accent">
                        <span
                          className="metric-tooltip-label"
                          tabIndex="0"
                          aria-describedby="relative-rate-tooltip"
                        >
                          Relative Rate
                          <span className="metric-tooltip" id="relative-rate-tooltip" role="tooltip">
                            How much more often your unique will drop compared to an empty tree.
                          </span>
                        </span>
                        <strong>{formatValue(scenario.result.relativeRate)}x</strong>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="error-banner">{scenarioError}</div>
                )}
              </section>
            </>
          ) : (
            <section className="panel-card fade-up readme-panel" style={{ animationDelay: "90ms" }}>
              <div className="panel-head">
                <h2>README</h2>
              </div>
              <a className="action-button" href={repositoryUrl} target="_blank" rel="noreferrer">
                Open The GitHub Repository
              </a>
            </section>
          )}
        </div>
      </aside>

      <section className="tree-stage">
        <div className="tree-board">
          {treeStatusMessage && (
            <div
              className={[
                "status-banner",
                "tree-status-banner",
                unsupportedTargetSelected ? "is-unsupported" : "",
              ].join(" ").trim()}
            >
              {treeStatusMessage}
            </div>
          )}
          <img
            src={treeImageUrl}
            alt="Genesis Tree screenshot"
            className="tree-image"
            width={TREE_IMAGE_WIDTH}
            height={TREE_IMAGE_HEIGHT}
          />
          <div className="tree-overlay">
            {TREE_NODE_IDS.map((nodeId) => {
                  const passive = PASSIVES[nodeId];
                  const position = NODE_LAYOUT[nodeId];
                  const isSelected = activePassives.includes(nodeId);
                  const isUnsupported = !passive.supported;
                  const isMuted = !passive.affectsRate;
                  const showsHoverSummary = (position.radius ?? 0) >= LARGE_NODE_RADIUS;
                  const showsDebugMultiplier = debugMode && shouldShowDebugMultiplier(nodeId);
                  const debugDetails = debugNodeMultipliers.get(nodeId) ?? null;

                  return (
                    <div
                      key={nodeId}
                      className={[
                        "tree-node",
                        isSelected ? "is-selected" : "",
                        isUnsupported ? "is-disabled" : "",
                        isMuted ? "is-muted" : "",
                        showsDebugMultiplier ? "has-debug" : "",
                      ].join(" ")}
                      style={nodeLayoutStyle(position)}
                    >
                      <button
                        type="button"
                        className={[
                          "tree-node-button",
                          mode === "manual" ? "is-interactive" : "",
                          isSelected ? "is-selected" : "",
                          isUnsupported ? "is-disabled" : "",
                          isMuted ? "is-muted" : "",
                        ].join(" ")}
                        onClick={() => handleNodeClick(nodeId)}
                        aria-label={`${isSelected ? "Refund" : "Allocate"} ${passive.name}`}
                      >
                        <span>{nodeId}</span>
                      </button>

                      <div className={`tree-node-caption ${showsHoverSummary ? "tree-node-caption--detailed" : ""}`}>
                        <span className="tree-node-label">{passive.name}</span>
                        {showsHoverSummary && <span className="tree-node-caption-detail">{passive.summary}</span>}
                      </div>

                      {showsDebugMultiplier && (
                        <div className={`tree-node-debug ${debugDetails?.tone}`}>
                          {debugDetails?.label}
                        </div>
                      )}
                    </div>
                  );
                })}
          </div>
        </div>
      </section>
    </main>
  );
}
