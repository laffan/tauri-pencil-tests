import { addPluginListener } from "@tauri-apps/api/core";

const inputEl  = document.getElementById("input");
const modeEl   = document.getElementById("mode");
const statusEl = document.getElementById("status");
const logEl    = document.getElementById("log");
const copyBtn  = document.getElementById("copy-btn");
const clearBtn = document.getElementById("clear-btn");

let mode = false;
let inputClearTimer;
const t0 = performance.now();

function ts() {
  const ms = (performance.now() - t0) | 0;
  return `[${String(ms).padStart(6, " ")}ms]`;
}

function log(line, cls = "") {
  const div = document.createElement("div");
  if (cls) div.className = cls;
  div.textContent = `${ts()} ${line}`;
  logEl.appendChild(div);
  logEl.scrollTop = logEl.scrollHeight;
}

function setStatus(text, kind /* "ok" | "err" | "" */) {
  statusEl.textContent = text;
  statusEl.classList.remove("ok", "err");
  if (kind) statusEl.classList.add(kind);
}

function setInput(kind) {
  inputEl.classList.remove("idle", "pencil", "finger");
  inputEl.classList.add(kind);
  inputEl.textContent = kind;
  clearTimeout(inputClearTimer);
  inputClearTimer = setTimeout(() => {
    inputEl.classList.remove("pencil", "finger");
    inputEl.classList.add("idle");
    inputEl.textContent = "—";
  }, 1500);
}

function setMode(on) {
  mode = on;
  modeEl.classList.toggle("on", mode);
  modeEl.classList.toggle("off", !mode);
  modeEl.textContent = `mode: ${mode ? "ON" : "OFF"}`;
}

// --- environment snapshot ----------------------------------------------------
log(`UA: ${navigator.userAgent}`, "info");
log(`PointerEvent: ${"PointerEvent" in window}`, "info");
log(`maxTouchPoints: ${navigator.maxTouchPoints}`, "info");
log(`addPluginListener: ${typeof addPluginListener}`, "info");

// --- raw PointerEvent test (parallel to the native plugin) -------------------
// This is what hush already gets for free. Logged so we can compare.
window.addEventListener("pointerdown", (e) => {
  log(`pointerdown  pointerType=${e.pointerType} pressure=${e.pressure.toFixed(2)} tilt=${e.tiltX},${e.tiltY}`);
}, { passive: true });

// --- plugin listeners --------------------------------------------------------
let pluginConnected = false;

try {
  log("registering plugin listeners…", "info");

  await addPluginListener("pencil", "loaded", () => {
    pluginConnected = true;
    setStatus("plugin connected", "ok");
    log("[plugin] loaded event received -> Swift bridge alive", "ok");
  });

  await addPluginListener("pencil", "touch", (payload) => {
    log(`[plugin] touch -> ${JSON.stringify(payload)}`, "ok");
    setInput(payload?.type === "pencil" ? "pencil" : "finger");
  });

  await addPluginListener("pencil", "double-tap", (payload) => {
    log(`[plugin] double-tap -> ${JSON.stringify(payload ?? {})}`, "ok");
    setMode(!mode);
  });

  setStatus("listeners registered (waiting for plugin…)", "ok");
  log("listeners registered, waiting for plugin loaded event…", "ok");
} catch (e) {
  setStatus(`listener error: ${e?.message || e}`, "err");
  log(`ERROR registering listeners: ${e?.stack || e?.message || e}`, "err");
}

// If we never hear from Swift, surface it after a few seconds.
setTimeout(() => {
  if (!pluginConnected) {
    setStatus("plugin not connected (no loaded event)", "err");
    log("WARNING: no 'loaded' event from Swift after 3s. The native plugin is likely not running.", "err");
  }
}, 3000);

// --- copy / clear ------------------------------------------------------------
copyBtn.addEventListener("click", async () => {
  const text = Array.from(logEl.children).map((d) => d.textContent).join("\n");
  let ok = false;
  try {
    await navigator.clipboard.writeText(text);
    ok = true;
  } catch (e) {
    log(`clipboard.writeText failed: ${e?.message || e}`, "err");
    // Fallback: select log text so user can long-press copy.
    try {
      const range = document.createRange();
      range.selectNodeContents(logEl);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      ok = true;
    } catch (e2) {
      log(`selection fallback failed: ${e2?.message || e2}`, "err");
    }
  }
  if (ok) {
    copyBtn.classList.add("flash");
    copyBtn.textContent = "Copied";
    setTimeout(() => {
      copyBtn.classList.remove("flash");
      copyBtn.textContent = "Copy";
    }, 1200);
  }
});

clearBtn.addEventListener("click", () => {
  logEl.innerHTML = "";
});
