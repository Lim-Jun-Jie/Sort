import {
  compileCustom,
  createCodeEditor,
  DEFAULT_CUSTOM_CODE,
  getEditorCode,
  runCustom,
  setEditorCode,
} from "./custom-algorithm.js";

const algorithms = [
  { id: "bubble", name: "Bubble Sort", description: "Repeatedly swaps neighboring values that are out of order.", best: "O(n)", average: "O(n²)", worst: "O(n²)", space: "O(1)", stability: "Stable · In-place" },
  { id: "selection", name: "Selection Sort", description: "Selects the smallest remaining value for each position.", best: "O(n²)", average: "O(n²)", worst: "O(n²)", space: "O(1)", stability: "Unstable · In-place" },
  { id: "insertion", name: "Insertion Sort", description: "Inserts each value into its place in the sorted prefix.", best: "O(n)", average: "O(n²)", worst: "O(n²)", space: "O(1)", stability: "Stable · In-place" },
  { id: "merge", name: "Merge Sort", description: "Splits the array, then merges sorted halves back together.", best: "O(n log n)", average: "O(n log n)", worst: "O(n log n)", space: "O(n)", stability: "Stable · Out-of-place" },
  { id: "quick", name: "Quick Sort", description: "Partitions around a pivot, then sorts each side.", best: "O(n log n)", average: "O(n log n)", worst: "O(n²)", space: "O(log n) avg / O(n) worst", stability: "Unstable · In-place" },
  { id: "heap", name: "Heap Sort", description: "Builds a max heap and repeatedly extracts its largest value.", best: "O(n log n)", average: "O(n log n)", worst: "O(n log n)", space: "O(1)", stability: "Unstable · In-place" },
  { id: "shell", name: "Shell Sort", description: "Sorts increasingly close elements with a shrinking gap.", best: "Gap-dependent", average: "Gap-dependent", worst: "Gap-dependent", space: "O(1)", stability: "Unstable · In-place" },
  { id: "counting", name: "Counting Sort", description: "Counts each value, then writes values back in order.", best: "O(n + k)", average: "O(n + k)", worst: "O(n + k)", space: "O(n + k)", stability: "Stable · Out-of-place" },
  { id: "radix", name: "Radix Sort", description: "Orders integer values one byte at a time.", best: "O(d(n + k))", average: "O(d(n + k))", worst: "O(d(n + k))", space: "O(n + k)", stability: "Stable · Out-of-place" },
];

const MAX_IMAGE_PREVIEW_HEIGHT = 400;

function createDefaultGradientSource() {
  const width = 800;
  const height = 600;
  const colors = Array.from({ length: 3 }, () =>
    `#${Math.floor(Math.random() * 0x1000000).toString(16).padStart(6, "0")}`);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not create the default gradient image.");
  const angle = Math.random() * Math.PI * 2;
  const halfWidth = Math.cos(angle) * width / 2;
  const halfHeight = Math.sin(angle) * height / 2;
  const gradient = context.createLinearGradient(
    width / 2 - halfWidth,
    height / 2 - halfHeight,
    width / 2 + halfWidth,
    height / 2 + halfHeight,
  );
  gradient.addColorStop(0, colors[0]);
  gradient.addColorStop(0.5, colors[1]);
  gradient.addColorStop(1, colors[2]);
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
  return {
    url: canvas.toDataURL("image/png"),
    width,
    height,
    name: "Random gradient",
  };
}

const state = {
  mode: "numbers",
  selected: ["bubble", "quick"],
  initial: [8, 3, 6, 1, 9, 2, 5, 4, 7],
  numberInitial: [8, 3, 6, 1, 9, 2, 5, 4, 7],
  imageSource: createDefaultGradientSource(),
  imagePuzzle: null,
  imageLoadRequest: 0,
  panels: new Map(),
  module: null,
  timer: null,
  playbackTick: 0,
  customAlgorithms: new Map(),
  editingCustomId: null,
  preparing: false,
  compilingCustom: false,
};

const elements = {
  status: document.querySelector("#wasm-status"),
  dataset: document.querySelector("#dataset-input"),
  size: document.querySelector("#size-input"),
  datasetControls: document.querySelector("#dataset-controls"),
  imageControls: document.querySelector("#image-controls"),
  modeButtons: document.querySelectorAll(".mode-button"),
  imageFile: document.querySelector("#image-file-input"),
  imageRows: document.querySelector("#image-rows-input"),
  imageColumns: document.querySelector("#image-columns-input"),
  createImagePuzzle: document.querySelector("#create-image-puzzle-button"),
  shuffleImagePuzzle: document.querySelector("#shuffle-image-puzzle-button"),
  imagePreviewWrap: document.querySelector("#image-preview-wrap"),
  imagePreview: document.querySelector("#image-preview"),
  imageSelectionStatus: document.querySelector("#image-selection-status"),
  speed: document.querySelector("#speed-input"),
  speedOutput: document.querySelector("#speed-output"),
  workspace: document.querySelector("#workspace"),
  library: document.querySelector("#library"),
  empty: document.querySelector("#empty-state"),
  count: document.querySelector("#algorithm-count"),
  play: document.querySelector("#play-button"),
  pause: document.querySelector("#pause-button"),
  step: document.querySelector("#step-button"),
  reset: document.querySelector("#reset-button"),
  customName: document.querySelector("#custom-name"),
  customFunctionName: document.querySelector("#custom-function-name"),
  customEditor: document.querySelector("#code-editor"),
  compileButton: document.querySelector("#compile-button"),
  saveCustomButton: document.querySelector("#save-custom-button"),
  compileStatus: document.querySelector("#compile-status"),
  compileOutput: document.querySelector("#compile-output"),
  savedAlgorithms: document.querySelector("#saved-algorithms-list"),
};

elements.imagePreview.src = state.imageSource.url;
elements.imagePreviewWrap.hidden = false;
elements.imageSelectionStatus.textContent =
  `${state.imageSource.name} · ${state.imageSource.width} × ${state.imageSource.height}`;

const CUSTOM_STORAGE_KEY = "sort.customAlgorithms.v2";
let codeEditor;

function setStatus(message, kind = "") {
  elements.status.textContent = message;
  elements.status.className = `wasm-status ${kind}`;
}

async function loadWasm() {
  if (typeof createSortModule !== "function") {
    setStatus("Build WebAssembly to run algorithms.", "error");
    return;
  }
  try {
    state.module = await createSortModule();
    setStatus("C++ WebAssembly ready", "ready");
  } catch (error) {
    setStatus(`WebAssembly failed to load: ${error.message}`, "error");
  }
}

function renderLibrary() {
  elements.library.innerHTML = [...algorithms, ...state.customAlgorithms.values()].map((algorithm) => {
    const selected = state.selected.includes(algorithm.id);
    const custom = state.customAlgorithms.has(algorithm.id);
    return `<article class="algorithm-card ${selected ? "selected" : ""}">
      <div class="algorithm-card-top"><h3>${escapeHtml(algorithm.name)}</h3>
        <button class="add-button" data-algorithm="${algorithm.id}" aria-label="${selected ? "Remove" : "Add"} ${escapeHtml(algorithm.name)}" title="${selected ? "Remove" : "Add"} ${escapeHtml(algorithm.name)}">${selected ? "−" : "+"}</button>
      </div>
      <p>${escapeHtml(algorithm.description)}</p>
      <div class="algorithm-meta">Best ${algorithm.best} · Avg ${algorithm.average}</div>
      <div class="algorithm-meta">Worst ${algorithm.worst} · ${algorithm.space}</div>
      <div class="algorithm-meta">${custom ? "Custom C++17 · Browser-only" : algorithm.stability}</div>
    </article>`;
  }).join("");
  elements.count.textContent = `${state.selected.length}/4`;
}

function getAlgorithm(id) {
  return state.customAlgorithms.get(id) ||
    algorithms.find((algorithm) => algorithm.id === id);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  })[character]);
}

function renderPanel(algorithm) {
  const panel = state.panels.get(algorithm.id);
  const ranking = getRanking(panel);
  const imagePuzzle = state.mode === "image" ? state.imagePuzzle : null;
  const tiles = panel.values.map((value, index) => {
    const classes = ["tile"];
    if (panel.highlights.includes(index)) classes.push(panel.highlightType);
    if (panel.sorted.has(index)) classes.push("sorted");
    if (imagePuzzle) {
      const column = value % imagePuzzle.columns;
      const row = Math.floor(value / imagePuzzle.columns);
      const x = column / (imagePuzzle.columns - 1) * 100;
      const y = row / (imagePuzzle.rows - 1) * 100;
      return `<span class="${classes.join(" ")} image-tile" role="img" aria-label="Image piece, row ${row + 1}, column ${column + 1}" style="background-position:${x}% ${y}%"></span>`;
    }
    return `<span class="${classes.join(" ")}">${value}</span>`;
  }).join("");
  const comparisons = panel.comparisons;
  const swaps = panel.swaps;
  const writes = panel.writes;
  const panelClass = panel.active ? " is-running" : panel.done ? " is-complete" : "";
  const panelStatus = ranking
    ? `${ordinal(ranking.position)}${ranking.tied ? " tie" : " place"} · ${panel.cursor} ops`
    : panel.active ? "Running" : panel.cursor ? "Paused" : "Ready";
  const rankClass = ranking?.position === 1
    ? "rank-gold"
    : ranking?.position === 2
      ? "rank-silver"
      : ranking?.position === 3
        ? "rank-bronze"
        : "rank-other";
  const rankBadge = ranking
    ? `<span class="rank-badge ${rankClass}" role="img" aria-label="${ordinal(ranking.position)} place${ranking.tied ? ", tied" : ""}" title="${ordinal(ranking.position)} place${ranking.tied ? ", tied" : ""}">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 7 4 4 5-7 5 7 4-4-2 12H5L3 7Z"/><path d="M5 21h14"/></svg>
        <span class="rank-number">${ranking.position}</span>
      </span>`
    : "";
  const board = imagePuzzle
    ? `<div class="tile-board image-puzzle-board" aria-label="${escapeHtml(algorithm.name)} image puzzle" style="--puzzle-columns:${imagePuzzle.columns};--puzzle-rows:${imagePuzzle.rows};--puzzle-image-width:${imagePuzzle.columns * 100}%;--puzzle-image-height:${imagePuzzle.rows * 100}%;--puzzle-max-width:${MAX_IMAGE_PREVIEW_HEIGHT * imagePuzzle.width / imagePuzzle.height}px;--puzzle-max-height:${MAX_IMAGE_PREVIEW_HEIGHT}px;aspect-ratio:${imagePuzzle.width}/${imagePuzzle.height}">${tiles}</div>`
    : state.mode === "image"
      ? '<div class="tile-board image-puzzle-empty">Upload an image and create a puzzle first.</div>'
      : `<div class="tile-board" aria-label="${escapeHtml(algorithm.name)} tile visualization">${tiles}</div>`;
  return `<article class="algorithm-panel${panelClass}" data-panel="${algorithm.id}">
    <div class="panel-heading">
      <div class="panel-title-wrap"><h3 class="panel-name">${escapeHtml(algorithm.name)}</h3><p class="panel-complexity">Avg ${algorithm.average} · Space ${algorithm.space}</p></div>
      <div class="panel-actions">
        <button class="icon-button" data-action="toggle" data-algorithm="${algorithm.id}" aria-label="${panel.active ? "Pause" : "Play"} ${escapeHtml(algorithm.name)}">${panel.active ? "Ⅱ" : "▶"}</button>
        <button class="icon-button" data-action="step" data-algorithm="${algorithm.id}" aria-label="Step ${escapeHtml(algorithm.name)}">→</button>
        <button class="icon-button" data-action="remove" data-algorithm="${algorithm.id}" aria-label="Remove ${escapeHtml(algorithm.name)}">×</button>
        ${rankBadge}
      </div>
    </div>
    ${board}
    <div class="panel-footer">
      <div class="stats"><span>Compare <strong>${comparisons}</strong></span><span>Swaps <strong>${swaps}</strong></span><span>Writes <strong>${writes}</strong></span></div>
      <span class="panel-state">${panelStatus}</span>
    </div>
  </article>`;
}

function getRanking(panel) {
  if (!panel.done || panel.completionTick === null) return null;
  const completed = [...state.panels.values()].filter(
    (candidate) => candidate.done && candidate.completionTick !== null,
  );
  const earlier = completed.filter(
    (candidate) => candidate.completionTick < panel.completionTick,
  ).length;
  const tied = completed.filter(
    (candidate) => candidate.completionTick === panel.completionTick,
  ).length > 1;
  return { position: earlier + 1, tied };
}

function ordinal(position) {
  const suffix = position % 100 >= 11 && position % 100 <= 13
    ? "th"
    : ["th", "st", "nd", "rd"][position % 10] || "th";
  return `${position}${suffix}`;
}

function renderWorkspace() {
  elements.workspace.innerHTML = state.selected
    .map((id) => renderPanel(getAlgorithm(id)))
    .join("");
  if (state.mode === "image" && state.imagePuzzle) {
    elements.workspace.querySelectorAll(".image-puzzle-board").forEach((board) => {
      board.style.setProperty("--puzzle-image", `url("${state.imagePuzzle.url}")`);
    });
  }
  elements.empty.hidden = state.selected.length !== 0;
  elements.count.textContent = `${state.selected.length}/4`;
}

function addAlgorithm(id) {
  if (!getAlgorithm(id)) return;
  let changed = false;
  if (state.selected.includes(id)) {
    state.selected = state.selected.filter((selected) => selected !== id);
    state.panels.delete(id);
    changed = true;
  } else if (state.selected.length < 4) {
    state.selected.push(id);
    changed = true;
  }
  if (changed) {
    stopPlayback();
    state.playbackTick = 0;
    for (const selected of state.selected) {
      state.panels.set(selected, newPanel());
    }
  }
  renderLibrary();
  renderWorkspace();
  renderSavedAlgorithms();
}

function renderSavedAlgorithms() {
  elements.savedAlgorithms.innerHTML = [...state.customAlgorithms.values()].map((algorithm) =>
    `<div class="saved-algorithm">
      <span>${escapeHtml(algorithm.name)}</span>
      <div>
        <button class="saved-action" data-saved-action="load" data-algorithm="${algorithm.id}">Edit</button>
        <button class="saved-action" data-saved-action="delete" data-algorithm="${algorithm.id}" aria-label="Delete ${escapeHtml(algorithm.name)}">Delete</button>
      </div>
    </div>`,
  ).join("") || '<p class="saved-empty">Saved algorithms stay in this browser.</p>';
}

function validateCustomName() {
  const name = elements.customName.value.trim();
  if (!name || name.length > 32) {
    throw new Error("Enter an algorithm name between 1 and 32 characters.");
  }
  return name;
}

function validateCustomFunctionName() {
  const functionName = elements.customFunctionName.value.trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]{0,31}$/.test(functionName)) {
    throw new Error("Use a C++ function name with letters, digits, or underscores; it cannot start with a digit.");
  }
  return functionName;
}

function showCompileStatus(message, kind = "") {
  elements.compileStatus.textContent = message;
  elements.compileStatus.className = `compile-status ${kind}`;
}

function persistCustomAlgorithms() {
  try {
    localStorage.setItem(CUSTOM_STORAGE_KEY, JSON.stringify(
      [...state.customAlgorithms.values()].map(
        ({ id, name, functionName, code }) => ({ id, name, functionName, code }),
      ),
    ));
    return true;
  } catch (error) {
    showCompileStatus(`Could not save in this browser: ${error.message}`, "error");
    return false;
  }
}

function loadCustomAlgorithms() {
  try {
    const stored = localStorage.getItem(CUSTOM_STORAGE_KEY);
    if (!stored) return;
    const saved = JSON.parse(stored);
    if (!Array.isArray(saved) || saved.length > 20) {
      throw new Error("Saved algorithm data has an invalid format.");
    }
    for (const item of saved) {
      if (!item || typeof item.id !== "string" ||
          !/^custom-[a-f0-9-]{36}$/.test(item.id) ||
          typeof item.name !== "string" || !item.name.trim() ||
          item.name.length > 32 || typeof item.functionName !== "string" ||
          !/^[A-Za-z_][A-Za-z0-9_]{0,31}$/.test(item.functionName) ||
          typeof item.code !== "string" ||
          item.code.length > 32768) {
        throw new Error("A saved algorithm has invalid data.");
      }
      state.customAlgorithms.set(item.id, {
        ...item,
        wasm: null,
        description: "A sorting algorithm written in C++17.",
        best: "User-defined",
        average: "Trace-based",
        worst: "User-defined",
        space: "Runtime-limited",
      });
    }
  } catch (error) {
    showCompileStatus(`Could not load saved algorithms: ${error.message}`, "error");
  }
}

function updateCustomAlgorithm(algorithm) {
  stopPlayback();
  state.playbackTick = 0;
  state.customAlgorithms.set(algorithm.id, algorithm);
  if (state.selected.includes(algorithm.id)) {
    for (const id of state.selected) state.panels.set(id, newPanel());
  } else if (state.selected.length < 4) {
    state.selected.push(algorithm.id);
    state.panels.set(algorithm.id, newPanel());
  }
  renderLibrary();
  renderWorkspace();
  renderSavedAlgorithms();
  return persistCustomAlgorithms();
}

function saveCustomCode() {
  const name = validateCustomName();
  const functionName = validateCustomFunctionName();
  const code = getEditorCode(codeEditor);
  if (!code.trim() || code.length > 32768) {
    throw new Error("Enter a sorting algorithm under 32 KB.");
  }
  const id = state.editingCustomId || `custom-${crypto.randomUUID()}`;
  const previous = state.customAlgorithms.get(id);
  const saved = updateCustomAlgorithm({
    id,
    name,
    functionName,
    code,
    wasm: previous?.code === code && previous.functionName === functionName
      ? previous.wasm
      : null,
    description: "A sorting algorithm written in C++17.",
    best: "User-defined",
    average: "Trace-based",
    worst: "User-defined",
    space: "Runtime-limited",
  });
  state.editingCustomId = id;
  if (saved) showCompileStatus("Code saved in this browser.", "ready");
}

function validateSortedResult(result, input) {
  if (!Array.isArray(result.values) || result.values.length !== input.length ||
      !Array.isArray(result.operations)) {
    throw new Error("The algorithm returned an invalid result.");
  }
  const expected = [...input].sort((first, second) => first - second);
  const actual = [...result.values].sort((first, second) => first - second);
  if (actual.some((value, index) => value !== expected[index]) ||
      result.values.some((value, index) => index > 0 && result.values[index - 1] > value)) {
    throw new Error("The algorithm did not produce a sorted permutation of the input.");
  }
}

async function compileAndAddCustom() {
  if (state.preparing || state.compilingCustom) return;
  const name = validateCustomName();
  const functionName = validateCustomFunctionName();
  const code = getEditorCode(codeEditor);
  if (!code.trim() || code.length > 32768) {
    throw new Error("Enter a sorting algorithm under 32 KB.");
  }
  state.compilingCustom = true;
  syncInteractionLock();
  try {
    const compiled = await compileCustom(code, functionName, (message) => showCompileStatus(message));
    const test = await runCustom(compiled.wasm, state.initial);
    validateSortedResult(test, state.initial);
    const id = state.editingCustomId || `custom-${crypto.randomUUID()}`;
    const saved = updateCustomAlgorithm({
      id,
      name,
      functionName,
      code,
      wasm: compiled.wasm,
      description: "A sorting algorithm written in C++17.",
      best: "User-defined",
      average: "Trace-based",
      worst: "User-defined",
      space: "Runtime-limited",
    });
    state.editingCustomId = id;
    elements.compileOutput.textContent = [
      compiled.diagnostics.trim(),
      test.stdout.trim(),
      test.stderr.trim(),
      `Compiled and verified on ${state.initial.length} values.`,
    ].filter(Boolean).join("\n");
    if (saved) {
      showCompileStatus(
        state.selected.includes(id)
          ? "Compiled and added to your comparison."
          : "Compiled and saved to the library; the comparison is full.",
        "ready",
      );
    }
  } finally {
    state.compilingCustom = false;
    syncInteractionLock();
  }
}

function loadCustomAlgorithm(id) {
  const algorithm = state.customAlgorithms.get(id);
  if (!algorithm) return;
  state.editingCustomId = id;
  elements.customName.value = algorithm.name;
  elements.customFunctionName.value = algorithm.functionName;
  setEditorCode(codeEditor, algorithm.code);
  elements.compileOutput.textContent = "Edit the code and compile it to update this algorithm.";
  showCompileStatus("Loaded saved code.");
  elements.customName.scrollIntoView({ behavior: "smooth", block: "center" });
}

function deleteCustomAlgorithm(id) {
  if (!state.customAlgorithms.delete(id)) return;
  state.selected = state.selected.filter((selected) => selected !== id);
  state.panels.delete(id);
  if (state.editingCustomId === id) state.editingCustomId = null;
  stopPlayback();
  state.playbackTick = 0;
  for (const selected of state.selected) state.panels.set(selected, newPanel());
  persistCustomAlgorithms();
  renderLibrary();
  renderWorkspace();
  renderSavedAlgorithms();
}

function newPanel() {
  return {
    values: [...state.initial],
    trace: [],
    cursor: 0,
    comparisons: 0,
    swaps: 0,
    writes: 0,
    sorted: new Set(),
    highlights: [],
    highlightType: "comparing",
    active: false,
    done: false,
    completionTick: null,
  };
}

function makeTrace(algorithmId) {
  const input = new Int32Array(state.initial);
  const module = state.module;
  const inputPointer = module._malloc(input.byteLength);
  const algorithmBytes = new TextEncoder().encode(`${algorithmId}\0`);
  const algorithmPointer = module._malloc(algorithmBytes.length);
  try {
    module.HEAP32.set(input, inputPointer >>> 2);
    module.HEAPU8.set(algorithmBytes, algorithmPointer);
    const result = JSON.parse(module.ccall(
      "sort_trace",
      "string",
      ["number", "number", "number"],
      [algorithmPointer, inputPointer, input.length],
    ));
    if (result.error) throw new Error(result.error);
    return result.operations;
  } finally {
    module._free(inputPointer);
    module._free(algorithmPointer);
  }
}

async function makeCustomTrace(algorithm) {
  if (!algorithm.wasm) {
    showCompileStatus("Loading compiler and compiling saved code…");
    const compiled = await compileCustom(
      algorithm.code,
      algorithm.functionName,
      showCompileStatus,
    );
    algorithm.wasm = compiled.wasm;
  }
  showCompileStatus(`Running ${algorithm.name}…`);
  const result = await runCustom(algorithm.wasm, state.initial);
  validateSortedResult(result, state.initial);
  const output = [result.stdout.trim(), result.stderr.trim()].filter(Boolean).join("\n");
  if (output) elements.compileOutput.textContent = output;
  showCompileStatus(`${algorithm.name} passed on ${state.initial.length} values.`, "ready");
  return result.operations;
}

function syncInteractionLock() {
  const locked = state.preparing || state.compilingCustom;
  document.querySelectorAll(
    ".controls button, .controls input, #library button, #workspace button, " +
    "#custom-name, #custom-function-name, #compile-button, #save-custom-button, " +
    "#saved-algorithms-list button",
  ).forEach((control) => { control.disabled = locked; });
  if (codeEditor) codeEditor.contentDOM.contentEditable = String(!locked);
}

function setPreparing(preparing) {
  state.preparing = preparing;
  syncInteractionLock();
}

async function prepareTraces() {
  if (state.mode === "image" && !state.imagePuzzle) {
    setStatus("Upload an image and create a puzzle first.", "error");
    return false;
  }
  if (!state.module) {
    setStatus("Build WebAssembly before starting a race.", "error");
    return false;
  }
  if (state.preparing) return false;
  setPreparing(true);
  try {
    stopPlayback();
    state.playbackTick = 0;
    for (const id of state.selected) {
      const panel = state.panels.get(id);
      const algorithm = getAlgorithm(id);
      panel.trace = state.customAlgorithms.has(id)
        ? await makeCustomTrace(algorithm)
        : makeTrace(id);
      panel.values = [...state.initial];
      panel.cursor = 0;
      panel.comparisons = 0;
      panel.swaps = 0;
      panel.writes = 0;
      panel.sorted.clear();
      panel.highlights = [];
      panel.active = false;
      panel.done = false;
      panel.completionTick = null;
    }
    return true;
  } catch (error) {
    setStatus(`Could not create trace: ${error.message}`, "error");
    elements.compileOutput.textContent = error.message;
    return false;
  } finally {
    setPreparing(false);
  }
}

function applyOperation(panel) {
  const wasDone = panel.done;
  const operation = panel.trace[panel.cursor++];
  panel.highlights = [];
  if (operation.type === "COMPARE") {
    panel.comparisons += 1;
    panel.highlights = [operation.first, operation.second].filter((index) => index >= 0);
    panel.highlightType = "comparing";
  } else if (operation.type === "SWAP") {
    panel.swaps += 1;
    panel.highlights = [operation.first, operation.second].filter((index) => index >= 0);
    panel.highlightType = "swapping";
    [panel.values[operation.first], panel.values[operation.second]] =
      [panel.values[operation.second], panel.values[operation.first]];
  } else if (operation.type === "WRITE") {
    panel.writes += 1;
    panel.highlights = [operation.first];
    panel.highlightType = "swapping";
    panel.values[operation.first] = operation.value;
  } else if (operation.type === "MARK_SORTED") {
    panel.sorted.add(operation.first);
  } else if (operation.type === "COMPLETE") {
    panel.done = true;
    panel.active = false;
    panel.sorted = new Set(panel.values.map((_, index) => index));
  }
  if (panel.cursor >= panel.trace.length) {
    panel.done = true;
    panel.active = false;
  }
  if (!wasDone && panel.done) {
    panel.completionTick = state.playbackTick;
  }
}

function tick() {
  state.playbackTick += 1;
  let running = false;
  for (const panel of state.panels.values()) {
    if (panel.active && !panel.done) {
      applyOperation(panel);
      running = running || panel.active;
    }
  }
  renderWorkspace();
  if (!running) stopPlayback();
}

function stopPlayback() {
  if (state.timer !== null) {
    window.clearInterval(state.timer);
    state.timer = null;
  }
}

function ensurePlayback() {
  if (state.timer !== null) return;
  const interval = 1000 / Number(elements.speed.value);
  state.timer = window.setInterval(tick, interval);
}

function restartPlayback() {
  stopPlayback();
  if ([...state.panels.values()].some((panel) => panel.active)) ensurePlayback();
}

function parseDataset(value) {
  const tokens = value.trim().split(/[\s,]+/).filter(Boolean);
  if (tokens.length < 2 || tokens.length > 256) {
    throw new Error("Enter between 2 and 256 integers.");
  }
  const numbers = tokens.map((token) => {
    if (!/^[+-]?\d+$/.test(token)) throw new Error(`Not an integer: ${token}`);
    const number = Number(token);
    if (!Number.isSafeInteger(number) || number < -2147483648 || number > 2147483647) {
      throw new Error(`Value is outside the 32-bit integer range: ${token}`);
    }
    return number;
  });
  return numbers;
}

function shuffleValues(values) {
  const shuffled = [...values];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[other]] = [shuffled[other], shuffled[index]];
  }
  return shuffled;
}

function setInitialValues(values) {
  state.initial = [...values];
  for (const id of state.selected) state.panels.set(id, newPanel());
  stopPlayback();
  state.playbackTick = 0;
  renderWorkspace();
}

function updateDataset(values) {
  state.numberInitial = [...values];
  elements.dataset.value = values.join(", ");
  elements.size.value = values.length;
  if (state.mode === "numbers") setInitialValues(values);
}

function setPuzzleMode(mode) {
  if (mode !== "numbers" && mode !== "image") return;
  state.mode = mode;
  elements.datasetControls.hidden = mode !== "numbers";
  elements.imageControls.hidden = mode !== "image";
  elements.modeButtons.forEach((button) => {
    const active = button.dataset.mode === mode;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  if (mode === "numbers") {
    setInitialValues(state.numberInitial);
    setStatus(
      state.module ? "C++ WebAssembly ready" : "Build WebAssembly to run algorithms.",
      state.module ? "ready" : "error",
    );
    return;
  }
  setInitialValues(state.imagePuzzle ? state.imagePuzzle.initial : []);
  setStatus(
    state.imagePuzzle
      ? `Image puzzle ready: ${state.imagePuzzle.rows} × ${state.imagePuzzle.columns}.`
      : `${state.imageSource.name} ready. Create a puzzle or upload your own image.`,
    state.imagePuzzle ? "ready" : "",
  );
}

async function loadPuzzleImage(file) {
  if (!file) return;
  const request = ++state.imageLoadRequest;
  elements.imageFile.value = "";
  const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
  if (!allowedTypes.has(file.type)) {
    setStatus("Choose a PNG, JPEG, or WebP image.", "error");
    return;
  }
  if (file.size < 1 || file.size > 10 * 1024 * 1024) {
    setStatus("Image files must be 10 MB or smaller.", "error");
    return;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;
    bitmap.close();
    if (request !== state.imageLoadRequest) return;
    if (width < 2 || height < 2 || width > 8192 || height > 8192) {
      throw new Error("Image dimensions must be between 2 and 8,192 pixels.");
    }

    const url = URL.createObjectURL(file);
    if (state.imageSource) URL.revokeObjectURL(state.imageSource.url);
    state.imageSource = { url, width, height, name: file.name };
    state.imagePuzzle = null;
    elements.imagePreview.src = url;
    elements.imagePreviewWrap.hidden = false;
    elements.imageSelectionStatus.textContent = `${file.name} · ${width} × ${height}`;
    if (state.mode === "image") {
      setInitialValues([]);
      setStatus("Image loaded. Choose a grid and create the puzzle.");
    }
  } catch (error) {
    if (request === state.imageLoadRequest) {
      setStatus(`Could not load image: ${error.message}`, "error");
    }
  }
}

function createImagePuzzle() {
  if (!state.imageSource) {
    setStatus("Choose an image before creating the puzzle.", "error");
    return;
  }
  const rows = Number(elements.imageRows.value);
  const columns = Number(elements.imageColumns.value);
  const pieceCount = rows * columns;
  if (!Number.isInteger(rows) || rows < 2 || rows > 10 ||
      !Number.isInteger(columns) || columns < 2 || columns > 10 ||
      pieceCount > 100) {
    setStatus("Choose between 2 and 10 rows and columns (up to 100 pieces).", "error");
    return;
  }
  state.imagePuzzle = {
    ...state.imageSource,
    rows,
    columns,
    initial: shuffleValues(Array.from({ length: pieceCount }, (_, index) => index)),
  };
  setPuzzleMode("image");
  setStatus(`Image puzzle created: ${rows} × ${columns}.`, "ready");
}

function shuffleImagePuzzle() {
  if (!state.imagePuzzle) {
    setStatus("Create an image puzzle before shuffling it.", "error");
    return;
  }
  state.imagePuzzle.initial = shuffleValues(
    Array.from({ length: state.imagePuzzle.rows * state.imagePuzzle.columns },
      (_, index) => index),
  );
  setInitialValues(state.imagePuzzle.initial);
  setStatus("Image puzzle shuffled.", "ready");
}

function clampNumberInput(input, minimum, maximum) {
  if (input.value === "") return;
  const value = Number(input.value);
  if (!Number.isFinite(value)) return;
  input.value = String(Math.max(minimum, Math.min(maximum, value)));
}

document.querySelector("#workspace").addEventListener("click", async (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const panel = state.panels.get(button.dataset.algorithm);
  if (!panel) return;
  if (button.dataset.action === "remove") {
    addAlgorithm(button.dataset.algorithm);
  } else if (button.dataset.action === "step") {
    if (panel.done && [...state.panels.values()].every((candidate) => candidate.done)) {
      if (!await prepareTraces()) return;
    }
    if (!panel.trace.length && !await prepareTraces()) return;
    panel.active = false;
    if (!panel.done) {
      state.playbackTick += 1;
      applyOperation(panel);
    }
    renderWorkspace();
  } else if (button.dataset.action === "toggle") {
    if (panel.done && [...state.panels.values()].every((candidate) => candidate.done)) {
      if (!await prepareTraces()) return;
    }
    if (!panel.trace.length && !await prepareTraces()) return;
    panel.active = !panel.active && !panel.done;
    renderWorkspace();
    ensurePlayback();
  }
});

document.querySelector("#apply-dataset").addEventListener("click", () => {
  try {
    updateDataset(parseDataset(elements.dataset.value));
    setStatus(state.module ? "C++ WebAssembly ready" : "Build WebAssembly to run algorithms.", state.module ? "ready" : "error");
  } catch (error) {
    setStatus(error.message, "error");
  }
});

elements.modeButtons.forEach((button) => {
  button.addEventListener("click", () => setPuzzleMode(button.dataset.mode));
});

elements.imageFile.addEventListener("change", (event) => {
  loadPuzzleImage(event.target.files?.[0]);
});

elements.createImagePuzzle.addEventListener("click", createImagePuzzle);
elements.shuffleImagePuzzle.addEventListener("click", shuffleImagePuzzle);

[
  { input: elements.size, minimum: 2, maximum: 100 },
  { input: elements.imageRows, minimum: 2, maximum: 10 },
  { input: elements.imageColumns, minimum: 2, maximum: 10 },
].forEach(({ input, minimum, maximum }) => {
  input.addEventListener("change", () =>
    clampNumberInput(input, minimum, maximum));
});

document.querySelector("#shuffle-button").addEventListener("click", () => {
  const size = Number(elements.size.value);
  if (!Number.isInteger(size) || size < 2 || size > 100) {
    setStatus("Choose a tile count between 2 and 100.", "error");
    return;
  }
  updateDataset(shuffleValues(Array.from({ length: size }, (_, index) => index + 1)));
  setStatus(state.module ? "C++ WebAssembly ready" : "Build WebAssembly to run algorithms.", state.module ? "ready" : "error");
});

elements.library.addEventListener("click", (event) => {
  const button = event.target.closest("[data-algorithm]");
  if (button) addAlgorithm(button.dataset.algorithm);
});

elements.savedAlgorithms.addEventListener("click", (event) => {
  const button = event.target.closest("[data-saved-action]");
  if (!button) return;
  if (button.dataset.savedAction === "load") {
    loadCustomAlgorithm(button.dataset.algorithm);
  } else if (button.dataset.savedAction === "delete") {
    deleteCustomAlgorithm(button.dataset.algorithm);
  }
});

elements.compileButton.addEventListener("click", async () => {
  try {
    await compileAndAddCustom();
  } catch (error) {
    showCompileStatus(error.message, "error");
    elements.compileOutput.textContent = error.message;
  }
});

elements.saveCustomButton.addEventListener("click", () => {
  try {
    saveCustomCode();
  } catch (error) {
    showCompileStatus(error.message, "error");
  }
});

document.querySelector("#play-button").addEventListener("click", async () => {
  if (!state.selected.length) {
    setStatus("Add an algorithm before starting a race.", "error");
    return;
  }
  const panels = [...state.panels.values()];
  if (panels.every((panel) => panel.done) ||
      panels.some((panel) => panel.trace.length === 0)) {
    if (!await prepareTraces()) return;
  }
  for (const panel of state.panels.values()) panel.active = !panel.done;
  renderWorkspace();
  ensurePlayback();
});

document.querySelector("#pause-button").addEventListener("click", () => {
  for (const panel of state.panels.values()) panel.active = false;
  stopPlayback();
  renderWorkspace();
});

document.querySelector("#step-button").addEventListener("click", async () => {
  if (!state.selected.length) {
    setStatus("Add an algorithm before stepping.", "error");
    return;
  }
  const panels = [...state.panels.values()];
  if (panels.every((panel) => panel.done) ||
      panels.some((panel) => panel.trace.length === 0)) {
    if (!await prepareTraces()) return;
  }
  state.playbackTick += 1;
  for (const panel of state.panels.values()) {
    panel.active = false;
    if (!panel.done) applyOperation(panel);
  }
  stopPlayback();
  renderWorkspace();
});

document.querySelector("#reset-button").addEventListener("click", () => {
  stopPlayback();
  state.playbackTick = 0;
  for (const [id] of state.panels) state.panels.set(id, newPanel());
  renderWorkspace();
});

elements.speed.addEventListener("input", () => {
  elements.speedOutput.value = `${elements.speed.value} ops/s`;
  restartPlayback();
});

loadCustomAlgorithms();
codeEditor = createCodeEditor(elements.customEditor, DEFAULT_CUSTOM_CODE);
renderLibrary();
renderSavedAlgorithms();
for (const id of state.selected) state.panels.set(id, newPanel());
renderWorkspace();
loadWasm();
