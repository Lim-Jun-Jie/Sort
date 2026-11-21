# Sort

**Live site:** [Open the Sorting Algorithm Visualizer](https://lim-jun-jie.github.io/Sort/)

An interactive sorting-algorithm comparison playground. Built-in algorithms
run in a C++17 core compiled to WebAssembly; the browser replays their
language-neutral operation traces as animated number tiles.
Completed algorithms are ranked by playback completion order; algorithms that
finish on the same playback tick share a rank.

## Clone and run locally

Install Git, CMake, Ninja, Python, and the [Emscripten SDK](https://emscripten.org/docs/getting_started/downloads.html). Clone the repository:

```powershell
git clone https://github.com/Lim-Jun-Jie/Sort.git
cd Sort
```

On Windows, build from an Emscripten-enabled terminal. For the default SDK location, run:

```powershell
& $env:ComSpec /c 'call "C:\emsdk\emsdk_env.bat" && emcmake cmake -S . -B build-wasm -G Ninja && cmake --build build-wasm'
```

If Emscripten is installed elsewhere, change `C:\emsdk\emsdk_env.bat` to the path to your SDK's `emsdk_env.bat`.

Then start a local web server from the repository root and open the site:

```powershell
python -m http.server 8000
```

Visit [http://localhost:8000/web/](http://localhost:8000/web/). Keep the server running while using the app; the browser needs the generated WebAssembly files and cannot load them directly from a `file://` URL.

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

This browser-only build does not compile or execute user-submitted C++.
Compiling arbitrary code safely requires a separately isolated compiler and
execution service, which is intentionally not part of this WebAssembly-only
prototype. Counting sort rejects datasets whose value range exceeds one
million to avoid impractical allocations.

## Publish on GitHub Pages

The workflow in `.github/workflows/deploy-pages.yml` builds the WebAssembly
module and deploys the static site on pushes to `main`. Enable **Settings →
Pages → Build and deployment → Source: GitHub Actions** once, then push to
`main`. Visitors can open the Pages URL without installing any tools.
