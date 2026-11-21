import { commands } from "@yowasp/clang";
import sortHelpersHeader from "./sort_helpers.hpp?raw";

const decoder = new TextDecoder();
const encoder = new TextEncoder();
let toolchainBaseUrl;

function insertFile(tree, path, bytes) {
  const parts = path.split("/");
  const name = parts.pop();
  let node = tree;
  for (const part of parts) {
    if (node[part] instanceof Uint8Array) {
      throw new Error(`Toolchain archive contains a conflicting path: ${path}`);
    }
    node = node[part] ||= {};
  }
  node[name] = bytes;
}

async function loadSysroot() {
  self.postMessage({ type: "status", message: "Loading C++ toolchain…" });
  const manifestResponse = await fetch(`${toolchainBaseUrl}manifest.json`);
  if (!manifestResponse.ok) throw new Error("Could not load the C++ toolchain manifest.");
  const manifest = await manifestResponse.json();
  if (!Number.isSafeInteger(manifest.compressedBytes) ||
      manifest.compressedBytes < 1 ||
      manifest.compressedBytes > 70 * 1024 * 1024) {
    throw new Error("The C++ toolchain archive has an invalid size.");
  }
  const assetResponse = await fetch(new URL(manifest.asset, toolchainBaseUrl));
  if (!assetResponse.ok) throw new Error("Could not download the C++ standard library.");
  const compressed = await assetResponse.arrayBuffer();
  if (compressed.byteLength !== manifest.compressedBytes) {
    throw new Error("The C++ standard library download was incomplete.");
  }
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", compressed));
  const actualHash = Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
  if (actualHash !== manifest.sha256) throw new Error("The C++ standard library checksum did not match.");

  const decompressed = await new Response(
    new Blob([compressed]).stream().pipeThrough(new DecompressionStream("gzip")),
  ).arrayBuffer();
  if (decompressed.byteLength > 300 * 1024 * 1024) {
    throw new Error("The unpacked C++ standard library is larger than expected.");
  }
  const view = new DataView(decompressed);
  const tree = {};
  let offset = 0;
  const count = view.getUint32(offset, true);
  offset += 4;
  if (count > 30000) throw new Error("The C++ standard library file index is invalid.");
  for (let index = 0; index < count; index += 1) {
    const pathLength = view.getUint32(offset, true);
    offset += 4;
    if (pathLength > 4096 || offset + pathLength + 4 > view.byteLength) {
      throw new Error("The C++ standard library archive is malformed.");
    }
    const path = decoder.decode(new Uint8Array(decompressed, offset, pathLength));
    offset += pathLength;
    const dataLength = view.getUint32(offset, true);
    offset += 4;
    if (!path.startsWith("sysroot/") || path.split("/").includes("..") ||
        dataLength > 100 * 1024 * 1024 || offset + dataLength > view.byteLength) {
      throw new Error("The C++ standard library archive contains an invalid entry.");
    }
    insertFile(tree, path, new Uint8Array(decompressed, offset, dataLength));
    offset += dataLength;
  }
  if (offset !== view.byteLength) throw new Error("The C++ standard library archive has trailing data.");
  return tree;
}

function makeSourceTree(source, functionName, sysroot) {
  const tree = { ...sysroot };
  insertFile(tree, "sort_helpers.hpp", encoder.encode(sortHelpersHeader));
  insertFile(tree, "user.cpp", encoder.encode(source));
  insertFile(tree, "runner.cpp", encoder.encode(
    '#include "sort_helpers.hpp"\n' +
    '#include <utility>\n' +
    '#include <vector>\n' +
    `std::vector<int> ${functionName}(std::vector<int>);\n` +
    'extern "C" __attribute__((export_name("run_sort"))) void sortviz_entry() {\n' +
    '  const int size = sortviz_size();\n' +
    '  std::vector<int> input;\n' +
    '  input.reserve(static_cast<std::size_t>(size));\n' +
    '  for (int index = 0; index < size; ++index) input.push_back(sortviz_read(index));\n' +
    `  auto result = ${functionName}(std::move(input));\n` +
    '  sortviz_validate_result_size(static_cast<int>(result.size()));\n' +
    '  for (int index = 0; index < size; ++index) sortviz_write(index, result[static_cast<std::size_t>(index)]);\n' +
    '}\n',
  ));
  return tree;
}

async function compile(source, functionName) {
  const sysroot = await loadSysroot();
  self.postMessage({ type: "status", message: "Compiling C++17…" });
  let diagnostics = "";
  const flags = [
    "--target=wasm32-wasip1",
    "--sysroot=sysroot",
    "-nostdinc++",
    "-isystem",
    "sysroot/include/wasm32-wasip1/eh/c++/v1",
    "-fwasm-exceptions",
    "-mllvm",
    "-wasm-use-legacy-eh=false",
    "-std=c++17",
    "-O1",
    "-Wall",
    "-Wextra",
    "-fno-rtti",
    "-Wl,--no-entry",
    "-Wl,--export=__cpp_exception",
    "-Wl,--initial-memory=16777216",
    "-Wl,--max-memory=33554432",
    "-Wl,-z,stack-size=131072",
    "-Lsysroot/lib/wasm32-wasip1/eh",
    "-lunwind",
    "user.cpp",
    "runner.cpp",
    "-o",
    "sort.wasm",
  ];
  let result;
  try {
    result = await commands["clang++"](flags, makeSourceTree(source, functionName, sysroot), {
      stderr(bytes) {
        if (bytes) diagnostics += decoder.decode(bytes, { stream: true });
      },
    });
  } catch (error) {
    const detail = diagnostics.trim();
    self.postMessage({
      type: "compile-error",
      diagnostics: detail ? `${error.message}\n${detail}` : error.message,
    });
    return;
  }
  const wasm = result?.["sort.wasm"];
  if (!(wasm instanceof Uint8Array)) {
    self.postMessage({ type: "compile-error", diagnostics: diagnostics || "The compiler produced no WebAssembly output." });
    return;
  }
  const wasmBuffer = wasm.slice().buffer;
  self.postMessage({ type: "compiled", wasm: wasmBuffer, diagnostics }, [wasmBuffer]);
}

self.addEventListener("message", (event) => {
  const source = event.data?.source;
  const functionName = event.data?.functionName;
  if (typeof source !== "string" || source.length > 32768) {
    self.postMessage({ type: "error", message: "Code must be less than 32 KB." });
    return;
  }
  if (typeof functionName !== "string" ||
      !/^[A-Za-z_][A-Za-z0-9_]{0,31}$/.test(functionName)) {
    self.postMessage({ type: "error", message: "Function name must be a C++ identifier." });
    return;
  }
  try {
    const base = new URL(event.data.toolchainBaseUrl);
    if (base.origin !== self.location.origin || !base.pathname.endsWith("/toolchain/")) {
      throw new Error("The toolchain URL must be a same-origin toolchain directory.");
    }
    toolchainBaseUrl = base.href;
  } catch (error) {
    self.postMessage({ type: "error", message: error.message });
    return;
  }
  compile(source, functionName).catch((error) => {
    self.postMessage({ type: "error", message: error instanceof Error ? error.message : String(error) });
  });
});
