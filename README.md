# Sort

**Live site:** [Open the Sorting Algorithm Visualizer](https://lim-jun-jie.github.io/Sort/)

An interactive sorting-algorithm comparison playground. Built-in algorithms
run in a C++17 core compiled to WebAssembly; the browser replays their
language-neutral operation traces as animated number tiles.
Completed algorithms are ranked by playback completion order; algorithms that
finish on the same playback tick share a rank.

## Clone and run locally

Install Git, CMake, Ninja, Python 3, Node.js 24+, and the [Emscripten SDK](https://emscripten.org/docs/getting_started/downloads.html). Clone the repository:

```powershell
git clone https://github.com/Lim-Jun-Jie/Sort.git
cd Sort
```

Prepare the C++ standard library toolchain and install the web dependencies:

```powershell
python scripts/prepare_toolchain.py
npm install
```

On Windows, build the built-in C++ WebAssembly module from an Emscripten-enabled terminal. For the default SDK location, run:

```powershell
& $env:ComSpec /c 'call "C:\emsdk\emsdk_env.bat" && emcmake cmake -S . -B build-wasm -G Ninja && cmake --build build-wasm'
```

If Emscripten is installed elsewhere, change `C:\emsdk\emsdk_env.bat` to your SDK's `emsdk_env.bat` path. Then build and serve the site:

```powershell
npm run build
python -m http.server --directory web/dist 8000
```

Open [http://localhost:8000/](http://localhost:8000/). The first custom C++ compile loads the browser compiler and standard library; visitors do not need to install or manually download tools.

## Native core tests

With a C++17 compiler and CMake installed:

```powershell
cmake -S . -B build
cmake --build build
ctest --test-dir build --output-on-failure
```

## Scope and execution model

The C++ core implements Bubble, Selection, Insertion, Merge, Quick, Heap,
Shell, Counting, and Radix sort. Each emits `COMPARE`, `SWAP`, `WRITE`,
`MARK_SORTED`, and `COMPLETE` operations; the visualization consumes the same
trace format regardless of algorithm. Comparison runs use identical input
arrays and advance one operation per active algorithm at each playback tick.
Built-in and custom sorting functions use the same C++ interface:
`vector<int> functionName(vector<int> unsorted)` (with `using std::vector;`).

Custom C++ functions receive a vector by value and return the sorted vector.
Include `sort_helpers.hpp` and use `sortviz::compare`, `sortviz::swap`,
`sortviz::write`, and `sortviz::markSorted` when you want those operations
shown individually during playback. Regular vector operations and standard
library algorithms work too; changes made without the helpers are visualized
as writes when the function returns. Custom C++ is compiled to WebAssembly in
a compiler worker and run in a separate, time-limited worker with a virtual
WASI environment. Submitted source stays in the browser, and saved algorithms
are stored locally. Counting sort rejects datasets whose value range exceeds
one million to avoid impractical allocations.

## Publish on GitHub Pages

The workflow in `.github/workflows/deploy-pages.yml` builds the WebAssembly
module and deploys the static site on pushes to `main`. Enable **Settings →
Pages → Build and deployment → Source: GitHub Actions** once, then push to
`main`. Visitors can open the Pages URL without installing any tools.
