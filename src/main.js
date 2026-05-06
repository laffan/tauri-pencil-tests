import { addPluginListener } from "@tauri-apps/api/core";

const inputEl = document.getElementById("input");
const modeEl = document.getElementById("mode");

let mode = false;
let clearTimer;

function setInput(kind) {
  inputEl.classList.remove("idle", "pencil", "finger");
  inputEl.classList.add(kind);
  inputEl.textContent = kind;
  clearTimeout(clearTimer);
  clearTimer = setTimeout(() => {
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

await addPluginListener("pencil", "touch", (payload) => {
  setInput(payload.type === "pencil" ? "pencil" : "finger");
});

await addPluginListener("pencil", "double-tap", () => {
  setMode(!mode);
});
