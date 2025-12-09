import { config } from "../../package.json";
import { buildEndpoint } from "../modules/settings";

function getZotero(): any {
  const w = window as any;
  return (
    w.Zotero ||
    w.opener?.Zotero ||
    w.parent?.Zotero ||
    (w.arguments && w.arguments[0]?.Zotero)
  );
}

function getPrefKey(key: string) {
  return `${config.prefsPrefix}.${key}`;
}

function getInput(id: string): HTMLInputElement | HTMLTextAreaElement {
  const el = document.getElementById(id);
  if (!el || (!(el instanceof HTMLInputElement) && !(el instanceof HTMLTextAreaElement))) {
    throw new Error(`Missing input ${id}`);
  }
  return el;
}

function initForm(Zotero: any) {
  const apiBase = getInput("api-base");
  const model = getInput("model");
  const apiKey = getInput("api-key");
  const customPrompts = getInput("custom-prompts");
  const status = document.getElementById("test-status") as HTMLDivElement;
  const testBtn = document.getElementById("test-btn") as HTMLButtonElement;

  apiBase.value =
    (Zotero.Prefs.get(getPrefKey("apiBase"), true) as string) ||
    "https://generativelanguage.googleapis.com/v1beta";
  model.value =
    (Zotero.Prefs.get(getPrefKey("model"), true) as string) ||
    "gemini-1.5-flash-latest";
  apiKey.value = (Zotero.Prefs.get(getPrefKey("apiKey"), true) as string) || "";
  customPrompts.value = (Zotero.Prefs.get(getPrefKey("customPrompts"), true) as string) || "[]";

  const save = (id: string, value: string) => {
    Zotero.Prefs.set(getPrefKey(id), value, true);
  };

  apiBase.addEventListener("change", () => save("apiBase", apiBase.value.trim()));
  model.addEventListener("change", () => save("model", model.value.trim()));
  apiKey.addEventListener("change", () => save("apiKey", apiKey.value.trim()));
  customPrompts.addEventListener("change", () => save("customPrompts", customPrompts.value.trim()));

  testBtn.addEventListener("click", async () => {
    status.textContent = "Testing...";
    status.style.color = "#555";
    try {
      const endpoint = buildEndpoint({
        apiBase: apiBase.value.trim(),
        apiKey: apiKey.value.trim(),
        model: model.value.trim(),
      });
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: "Ping from Zotero Gemini Chat preferences." }] }],
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`${res.status} ${res.statusText}: ${text}`);
      }
      status.textContent = "OK";
      status.style.color = "#2e7d32";
    } catch (e: any) {
      status.textContent = `Failed: ${e?.message || e}`;
      status.style.color = "#b3261e";
    }
  });
}

window.addEventListener("DOMContentLoaded", () => {
  const Zotero = getZotero();
  if (!Zotero) {
    const status = document.getElementById("test-status");
    if (status) status.textContent = "Zotero not found. Preferences cannot load.";
    return;
  }
  initForm(Zotero);
});

