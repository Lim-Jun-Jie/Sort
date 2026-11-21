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

const state = {
  selected: ["bubble", "quick"],
  initial: [8, 3, 6, 1, 9, 2, 5, 4, 7],
  panels: new Map(),
  module: null,
  timer: null,
};

const elements = {
  status: document.querySelector("#wasm-status"),
  dataset: document.querySelector("#dataset-input"),
  size: document.querySelector("#size-input"),
  speed: document.querySelector("#speed-input"),
  speedOutput: document.querySelector("#speed-output"),
  workspace: document.querySelector("#workspace"),
  library: document.querySelector("#library"),
  empty: document.querySelector("#empty-state"),
  count: document.querySelector("#algorithm-count"),
};

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
  elements.library.innerHTML = algorithms.map((algorithm) => {
    const selected = state.selected.includes(algorithm.id);
    return `<article class="algorithm-card ${selected ? "selected" : ""}">
      <div class="algorithm-card-top"><h3>${algorithm.name}</h3>
        <button class="add-button" data-algorithm="${algorithm.id}" aria-label="${selected ? "Remove" : "Add"} ${algorithm.name}" title="${selected ? "Remove" : "Add"} ${algorithm.name}">${selected ? "−" : "+"}</button>
      </div>
      <p>${algorithm.description}</p>
      <div class="algorithm-meta">Best ${algorithm.best} · Avg ${algorithm.average}</div>
      <div class="algorithm-meta">Worst ${algorithm.worst} · ${algorithm.space}</div>
      <div class="algorithm-meta">${algorithm.stability}</div>
    </article>`;
  }).join("");
  elements.count.textContent = `${state.selected.length}/4`;
}

function renderPanel(algorithm) {
  const panel = state.panels.get(algorithm.id);
  const tiles = panel.values.map((value, index) => {
    const classes = ["tile"];
    if (panel.highlights.includes(index)) classes.push(panel.highlightType);
    if (panel.sorted.has(index)) classes.push("sorted");
    return `<span class="${classes.join(" ")}">${value}</span>`;
  }).join("");
  const comparisons = panel.comparisons;
  const swaps = panel.swaps;
  const writes = panel.writes;
  return `<article class="algorithm-panel" data-panel="${algorithm.id}">
    <div class="panel-heading">
      <div class="panel-title-wrap"><h3 class="panel-name">${algorithm.name}</h3><p class="panel-complexity">Avg ${algorithm.average} · Space ${algorithm.space}</p></div>
      <div class="panel-actions">
        <button class="icon-button" data-action="toggle" data-algorithm="${algorithm.id}" aria-label="${panel.active ? "Pause" : "Play"} ${algorithm.name}">${panel.active ? "Ⅱ" : "▶"}</button>
        <button class="icon-button" data-action="step" data-algorithm="${algorithm.id}" aria-label="Step ${algorithm.name}">→</button>
        <button class="icon-button" data-action="remove" data-algorithm="${algorithm.id}" aria-label="Remove ${algorithm.name}">×</button>
      </div>
    </div>
    <div class="tile-board" aria-label="${algorithm.name} tile visualization">${tiles}</div>
    <div class="panel-footer">
      <div class="stats"><span>Compare <strong>${comparisons}</strong></span><span>Swaps <strong>${swaps}</strong></span><span>Writes <strong>${writes}</strong></span></div>
      <span class="panel-state">${panel.done ? "Complete" : panel.active ? "Running" : panel.cursor ? "Paused" : "Ready"}</span>
    </div>
  </article>`;
}

function renderWorkspace() {
  elements.workspace.innerHTML = state.selected
    .map((id) => renderPanel(algorithms.find((algorithm) => algorithm.id === id)))
    .join("");
  elements.empty.hidden = state.selected.length !== 0;
  elements.count.textContent = `${state.selected.length}/4`;
}

function addAlgorithm(id) {
  if (state.selected.includes(id)) {
    state.selected = state.selected.filter((selected) => selected !== id);
    state.panels.delete(id);
  } else if (state.selected.length < 4) {
    state.selected.push(id);
    state.panels.set(id, newPanel());
  }
  renderLibrary();
  renderWorkspace();
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

function prepareTraces() {
  if (!state.module) {
    setStatus("Build WebAssembly before starting a race.", "error");
    return false;
  }
  try {
    for (const id of state.selected) {
      const panel = state.panels.get(id);
      panel.trace = makeTrace(id);
      panel.values = [...state.initial];
      panel.cursor = 0;
      panel.comparisons = 0;
      panel.swaps = 0;
      panel.writes = 0;
      panel.sorted.clear();
      panel.highlights = [];
      panel.active = false;
      panel.done = false;
    }
    return true;
  } catch (error) {
    setStatus(`Could not create trace: ${error.message}`, "error");
    return false;
  }
}

function applyOperation(panel) {
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
}

function tick() {
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

function updateDataset(values) {
  state.initial = values;
  elements.dataset.value = values.join(", ");
  elements.size.value = values.length;
  for (const [id] of state.panels) state.panels.set(id, newPanel());
  stopPlayback();
  renderWorkspace();
}

document.querySelector("#library").addEventListener("click", (event) => {
  const button = event.target.closest("[data-algorithm]");
  if (button) addAlgorithm(button.dataset.algorithm);
});

document.querySelector("#workspace").addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const panel = state.panels.get(button.dataset.algorithm);
  if (!panel) return;
  if (button.dataset.action === "remove") {
    addAlgorithm(button.dataset.algorithm);
  } else if (button.dataset.action === "step") {
    if (!panel.trace.length && !prepareTraces()) return;
    panel.active = false;
    if (!panel.done) applyOperation(panel);
    renderWorkspace();
  } else if (button.dataset.action === "toggle") {
    if (!panel.trace.length && !prepareTraces()) return;
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

document.querySelector("#shuffle-button").addEventListener("click", () => {
  const size = Number(elements.size.value);
  if (!Number.isInteger(size) || size < 2 || size > 100) {
    setStatus("Choose a tile count between 2 and 100.", "error");
    return;
  }
  const values = Array.from({ length: size }, (_, index) => index + 1);
  for (let index = values.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1));
    [values[index], values[other]] = [values[other], values[index]];
  }
  updateDataset(values);
  setStatus(state.module ? "C++ WebAssembly ready" : "Build WebAssembly to run algorithms.", state.module ? "ready" : "error");
});

document.querySelector("#play-button").addEventListener("click", () => {
  if (!state.selected.length) {
    setStatus("Add an algorithm before starting a race.", "error");
    return;
  }
  if (![...state.panels.values()].every((panel) => panel.trace.length) && !prepareTraces()) return;
  for (const panel of state.panels.values()) panel.active = !panel.done;
  renderWorkspace();
  ensurePlayback();
});

document.querySelector("#pause-button").addEventListener("click", () => {
  for (const panel of state.panels.values()) panel.active = false;
  stopPlayback();
  renderWorkspace();
});

document.querySelector("#step-button").addEventListener("click", () => {
  if (!state.selected.length) {
    setStatus("Add an algorithm before stepping.", "error");
    return;
  }
  if (![...state.panels.values()].every((panel) => panel.trace.length) && !prepareTraces()) return;
  for (const panel of state.panels.values()) {
    panel.active = false;
    if (!panel.done) applyOperation(panel);
  }
  stopPlayback();
  renderWorkspace();
});

document.querySelector("#reset-button").addEventListener("click", () => {
  stopPlayback();
  for (const [id] of state.panels) state.panels.set(id, newPanel());
  renderWorkspace();
});

elements.speed.addEventListener("input", () => {
  elements.speedOutput.value = `${elements.speed.value} ops/s`;
  restartPlayback();
});

renderLibrary();
for (const id of state.selected) state.panels.set(id, newPanel());
renderWorkspace();
loadWasm();
