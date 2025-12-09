import { config } from "../../package.json";

function getPrefKey(key: string) {
  return `${config.prefsPrefix}.${key}`;
}

export function getSettings() {
  return {
    apiBase:
      (Zotero.Prefs.get(getPrefKey("apiBase"), true) as string) ||
      "https://generativelanguage.googleapis.com/v1beta",
    model:
      (Zotero.Prefs.get(getPrefKey("model"), true) as string) ||
      "gemini-1.5-flash-latest",
    apiKey: (Zotero.Prefs.get(getPrefKey("apiKey"), true) as string) || "",
    customPrompts: (Zotero.Prefs.get(getPrefKey("customPrompts"), true) as string) || "[]",
  };
}

export function buildEndpoint(settings: ReturnType<typeof getSettings>): string {
  return `${settings.apiBase}/models/${settings.model}:generateContent?key=${settings.apiKey}`;
}

