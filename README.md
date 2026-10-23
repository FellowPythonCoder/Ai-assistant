# AETHER OS

A local-first, OS-style **macOS application**, built with Electron and a read-only Swift metrics helper. It is not a replacement for macOS, Finder, the login screen, or the kernel.

## Run

Requires a Mac, Node.js 22+, and Xcode Command Line Tools (`xcode-select --install`).

```sh
npm ci
npm run build:native
npm start
```

For the browser-only interactive preview on any platform:

```sh
npm run preview
# http://localhost:5173
```

The preview deliberately has **no native telemetry, installed-app access, file access, or model execution**. It never substitutes browser RAM, Linux host memory, random numbers, or demo graphs for Mac statistics. Model and native operations show an honest unavailable state.

## Build the DMG on macOS

```sh
npm ci
npm test
npm run dist:mac
```

Outputs Apple Silicon and Intel `.dmg` files in `dist/`. The helper is a universal binary. The **Build macOS DMG** GitHub Actions workflow also builds both installers on a Mac runner; run it from the Actions tab after these changes are pushed. Download the `AETHER-macOS-unsigned-DMG` artifact from the successful run.

**No DMG is included in this checkout.** Implementation was performed on Linux, which cannot compile the Apple-framework helper or run `hdiutil`. The workflow and Swift source have not yet been executed on a Mac. A successful native build and real-device acceptance run are release requirements, not claimed results.

The workflow produces **unsigned, unnotarized** development builds. Gatekeeper may block them. Public distribution requires an Apple Developer ID certificate and notarization configured in electron-builder using protected CI secrets; never commit signing credentials. No administrator password, privileged daemon or full-disk access is required by AETHER.

## Desktop interactions

- Floating dock opens, restores and focuses seven working tools.
- Drag title bars; use traffic-light controls to close/minimize/maximize. Double-click a title bar to maximize. Drag to a screen edge to snap left/right, or to the top to maximize.
- Command palette: **⌘⇧Space** globally while the Mac app runs; **⌘K / Ctrl K** inside the workspace. Arrow keys and Enter select results. Escape dismisses panels.
- App launcher discovers `.app` bundles directly under `/Applications`, `/System/Applications`, and `~/Applications`. Nested utility folders and external volumes are not recursively indexed yet.
- Overview lists open/minimized AETHER windows and the current AI job. **Alt Tab** opens this workspace overview; it does not override the native macOS app switcher.
- Memory widget can be moved by its header, hidden, or restored in Settings. Accent, wallpaper, density and animation preferences persist locally. Window positions are session-only.
- Notification center records resource warnings and AI job results. Quick settings controls AETHER effects and opens detailed controls. It does not pretend to control system Wi-Fi, audio or brightness.
- Files requires an explicit folder picker. Browse grid/list, filter the current directory, preview small text files, open with macOS, rename, and move to Trash with confirmation. Real paths are checked to block traversal and out-of-scope symlinks. Search is a current-folder filter, not a recursive Spotlight implementation. At most 500 entries are returned per listing. No permanent delete or arbitrary shell command bridge is exposed.

## Native measurement accounting

`native/Metrics.swift` emits newline-delimited JSON every two seconds, independently of the renderer. Only a fixed set of bridge actions is exposed via a sandboxed preload; no Node.js integration is enabled in web content. Main-frame origin validation and a restrictive CSP protect IPC. Web permission requests default to deny.

- **Physical memory:** `ProcessInfo.physicalMemory`, dynamically detected.
- **VM pages:** `host_statistics64(HOST_VM_INFO64)` and the native page size.
- Darwin's exported free count includes speculative pages. The displayed free-only bucket subtracts speculative pages before showing them separately.
- **Available estimate = free-only + inactive + speculative**, bounded by physical total. This is a practical reclaimable-memory estimate, not a promise of immediately allocatable memory. Active file caches can also be reclaimable, but are not guessed here.
- **Estimated used = physical total − available estimate.** Thus used + available = total. This estimate can differ from Activity Monitor's app/wired/compressed classification.
- Compressor physical pages and wired pages are subsets of used, not additional totals. Compressed logical size is not confused with its physical footprint. Swap uses `vm.swapusage`, is explicitly separate disk allocation, and is not added to physical used.
- **Pressure:** actual DispatchSource macOS pressure events. State remains `unknown` until the OS supplies an event; it is never inferred from a made-up percentage threshold.
- **Processes:** `/bin/ps` provides PID, parent PID, UID, resident memory, average CPU percentage, status and executable path. CPU is labeled lifetime average, not a fabricated interval rate. RSS can contain shared pages and is **not** summed to derive system memory used. AETHER's main process and visible descendants are grouped separately from Ollama executables. GPU/unified-memory allocations may not be fully attributable to process RSS.
- **Power/network:** IOKit power sources and Network.framework path monitoring. Desktops without a battery show AC; unsupported data is unavailable. No SSID/location access requested.
- Samples expire after ten seconds without an update. In-memory history retains up to one hour of genuine session samples, with selected-range min/mean/max and measured pressure-event markings. Gaps are not interpolated into manufactured samples.

## Local AI and safety

Install/run Ollama separately at its default local API address `127.0.0.1:11434`. Only the Electron main process talks to that address; the web renderer does not call browser-localhost APIs.

System questions such as “How much RAM is left?”, “Which process uses the most memory?”, “How much memory is Ollama consuming?”, and “Can I safely load the 8B model?” are answered by deterministic measured-data tools. Other prompts use the installed model name entered in AI Workspace.

Before generation/loading, fresh native telemetry is mandatory. Enter an **estimated runtime budget in GB**; model disk size is never used as a RAM estimate. AETHER keeps a reserve of the greater of 2 GiB or 15% physical memory for OS/GPU headroom, blocks critical pressure, and blocks simultaneous different models unless explicitly allowed and the estimate fits. Estimates do not guarantee successful inference. Use a smaller quantization/context if necessary. The app never downloads models automatically.

Effects are reduced on elevated/critical measured pressure. Notifications suggest unloading idle models; unloading requires native confirmation. Eligible user app processes can be signaled only after confirmation; protected system paths, root processes, and AETHER components are blocked. Force quit explicitly warns about unsaved data. AETHER never automatically kills applications.

One inference job runs at a time. Cancel aborts the HTTP connection; this is best-effort cancellation, since Ollama may continue server-side briefly. The selected model can be explicitly unloaded after cancellation. Loaded models are queried from `/api/ps`. Ollama's reported runtime allocation is labeled separately from OS RSS; neither is presented as exact model GPU residency.

## Verification status

`npm test`: ten automated policy and DOM interaction tests. Synthetic telemetry is used **only in tests**, never shipped as sample runtime data. `npm audit`: zero known vulnerabilities at implementation time.

**Still required on real macOS hardware before release:**

- [ ] Compile universal Swift helper and both DMGs; open installer and launch application.
- [ ] Match physical total against System Information; compare documented VM estimates against `vm_stat`, not a different accounting definition.
- [ ] Verify updates every two seconds, changing process RSS, battery, network and uptime.
- [ ] Compare AETHER / Ollama PID groups and RSS against Activity Monitor; investigate GPU-accounting differences.
- [ ] Validate real pressure transitions safely, never force memory exhaustion merely for a test.
- [ ] Record genuine 1m / 5m / 15m / 1h histories; check range statistics.
- [ ] Run local inference and cancellation while moving/resizing windows; check responsiveness.
- [ ] Confirm file scope restrictions, missing helper, native API denial, Ollama offline, stale data, and process-signal permission failures.
- [ ] Confirm native shortcut, application launches, snapping, full screen, and destructive-action confirmations.
- [ ] Sign and notarize a distribution build.

Do not mark real-Mac acceptance tests complete based on Linux or DOM test results.
