import { ConsoleStdout, File, OpenFile, WASI } from "@bjorn3/browser_wasi_shim";

const MAX_OPERATIONS = 100000;
const MAX_OUTPUT = 65536;

function run({ wasm, values }) {
  const operations = [];
  let outputLength = 0;
  let stdout = "";
  let stderr = "";
  let nextSequence = 0;
  const array = new Int32Array(values);
  const decoder = new TextDecoder();
  const output = (stream) => new ConsoleStdout((bytes) => {
    if (!bytes) return;
    outputLength += bytes.length;
    if (outputLength > MAX_OUTPUT) throw new Error("Program output exceeded the 64 KB limit.");
    if (stream === "stdout") stdout += decoder.decode(bytes, { stream: true });
    else stderr += decoder.decode(bytes, { stream: true });
  });
  const record = (type, first, second, value) => {
    if (operations.length >= MAX_OPERATIONS) {
      throw new Error("Operation limit exceeded (100,000). Try a smaller dataset or a more efficient algorithm.");
    }
    operations.push({ type, first, second, value, sequence: nextSequence++ });
  };
  const checkIndex = (index) => {
    if (!Number.isInteger(index) || index < 0 || index >= array.length) {
      throw new Error(`Array index out of bounds: ${index}`);
    }
  };
  const compare = (first, second, value) => {
    checkIndex(first);
    if (second >= 0) checkIndex(second);
    const right = second >= 0 ? array[second] : value;
    record("COMPARE", first, second, right);
    return array[first] < right ? -1 : array[first] > right ? 1 : 0;
  };
  const sortviz = {
    size: () => array.length,
    read(index) {
      checkIndex(index);
      return array[index];
    },
    compare(first, second) {
      return compare(first, second, 0);
    },
    compare_value(index, value) {
      if (!Number.isInteger(value)) throw new Error("Comparison value must be an integer.");
      return compare(index, -1, value);
    },
    swap(first, second) {
      checkIndex(first);
      checkIndex(second);
      if (first === second) return;
      record("SWAP", first, second, array[second]);
      [array[first], array[second]] = [array[second], array[first]];
    },
    write(index, value) {
      checkIndex(index);
      if (!Number.isInteger(value) || value < -2147483648 || value > 2147483647) {
        throw new Error("Written values must be 32-bit integers.");
      }
      if (array[index] === value) return;
      array[index] = value;
      record("WRITE", index, -1, value);
    },
    mark_sorted(index) {
      checkIndex(index);
      record("MARK_SORTED", index, -1, array[index]);
    },
    validate_result_size(size) {
      if (size !== array.length) {
        throw new Error("The sorting function must return the same number of values it received.");
      }
    },
  };
  const wasi = new WASI(
    ["custom-sort"],
    [],
    [new OpenFile(new File([])), output("stdout"), output("stderr")],
  );
  const module = new WebAssembly.Module(wasm);
  const imports = WebAssembly.Module.imports(module);
  for (const item of imports) {
    if (item.module !== "sortviz" && item.module !== "wasi_snapshot_preview1") {
      throw new Error(`Unsupported WebAssembly import: ${item.module}.${item.name}`);
    }
  }
  const instance = new WebAssembly.Instance(module, {
    sortviz,
    wasi_snapshot_preview1: wasi.wasiImport,
  });
  if (typeof instance.exports._initialize === "function") wasi.initialize(instance);
  if (typeof instance.exports.run_sort !== "function") {
    throw new Error("Compiled algorithm did not export its entry point.");
  }
  instance.exports.run_sort();
  record("COMPLETE", -1, -1, 0);
  return {
    values: Array.from(array),
    operations,
    stdout,
    stderr,
  };
}

self.addEventListener("message", (event) => {
  try {
    const result = run(event.data);
    self.postMessage({ type: "complete", result });
  } catch (error) {
    self.postMessage({
      type: "error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});
