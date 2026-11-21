import { basicSetup, EditorView } from "codemirror";
import { cpp } from "@codemirror/lang-cpp";
import { EditorState } from "@codemirror/state";

export const DEFAULT_CUSTOM_CODE = `#include "sort_helpers.hpp"
#include <vector>

using std::vector;

vector<int> mySort(vector<int> unsorted) {
    const int size = static_cast<int>(unsorted.size());
    for (int end = size - 1; end > 0; --end) {
        bool changed = false;
        for (int index = 0; index < end; ++index) {
            if (sortviz::compare(unsorted, index, index + 1) > 0) {
                sortviz::swap(unsorted, index, index + 1);
                changed = true;
            }
        }
        sortviz::markSorted(end);
        if (!changed) break;
    }
    if (size > 0) sortviz::markSorted(0);
    return unsorted;
}`;

const COMPILER_TIMEOUT_MS = 300000;
const RUN_TIMEOUT_MS = 2500;

export function createCodeEditor(parent, initialCode) {
  return new EditorView({
    state: EditorState.create({
      doc: initialCode,
      extensions: [basicSetup, cpp(), EditorView.lineWrapping],
    }),
    parent,
  });
}

export function getEditorCode(editor) {
  return editor.state.doc.toString();
}

export function setEditorCode(editor, code) {
  editor.dispatch({
    changes: { from: 0, to: editor.state.doc.length, insert: code },
  });
}

export function compileCustom(source, functionName, onStatus) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./custom-compiler.worker.js", import.meta.url), {
      type: "module",
      name: "sort-cpp-compiler",
    });
    const timeout = setTimeout(() => {
      worker.terminate();
      reject(new Error("Compilation timed out. The compiler worker was stopped."));
    }, COMPILER_TIMEOUT_MS);
    const finish = (callback, value) => {
      clearTimeout(timeout);
      worker.terminate();
      callback(value);
    };
    worker.addEventListener("message", (event) => {
      const message = event.data;
      if (message.type === "status") {
        onStatus(message.message);
      } else if (message.type === "compiled") {
        finish(resolve, { wasm: new Uint8Array(message.wasm), diagnostics: message.diagnostics });
      } else if (message.type === "compile-error" || message.type === "error") {
        finish(reject, new Error(message.diagnostics || message.message));
      }
    });
    worker.addEventListener("error", (event) => {
      finish(reject, new Error(event.message || "The compiler worker crashed."));
    });
    worker.postMessage({
      source,
      functionName,
      toolchainBaseUrl: new URL("./toolchain/", document.baseURI).href,
    });
  });
}

export function runCustom(wasm, values) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./custom-runner.worker.js", import.meta.url), {
      type: "module",
      name: "sort-cpp-runner",
    });
    const timeout = setTimeout(() => {
      worker.terminate();
      reject(new Error("Algorithm exceeded the 2.5 second execution limit."));
    }, RUN_TIMEOUT_MS);
    const finish = (callback, value) => {
      clearTimeout(timeout);
      worker.terminate();
      callback(value);
    };
    worker.addEventListener("message", (event) => {
      const message = event.data;
      if (message.type === "complete") {
        finish(resolve, message.result);
      } else if (message.type === "error") {
        finish(reject, new Error(message.message));
      }
    });
    worker.addEventListener("error", (event) => {
      finish(reject, new Error(event.message || "The algorithm runner crashed."));
    });
    const wasmCopy = wasm.slice();
    worker.postMessage(
      { wasm: wasmCopy.buffer, values },
      [wasmCopy.buffer],
    );
  });
}
