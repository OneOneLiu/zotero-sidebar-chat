import { config } from "../package.json";
import { registerPreferencePane } from "./modules/prefsPane";
import { registerReaderPane, registerSidebarButton } from "./modules/readerPane";

export type ChatMessage = {
  role: "user" | "model" | "system";
  text: string;
  at: number;
};

class Addon {
  public data: {
    config: typeof config;
    paneKey: string;
    sessions: Record<string, ChatMessage[]>;
    busy: Record<string, boolean>;
  };

  constructor() {
    this.data = {
      config,
      paneKey: "",
      sessions: {},
      busy: {},
    };
  }

  public async onload(): Promise<void> {
    Zotero.debug(`[${config.addonName}] Initializing...`);
    await Promise.all([
      Zotero.initializationPromise,
      Zotero.unlockPromise,
      Zotero.uiReadyPromise,
    ]);

    // Load locale for existing windows
    Zotero.getMainWindows().forEach((win) => {
      this.onMainWindowLoad(win);
    });

    registerPreferencePane();
    this.data.paneKey = registerReaderPane(this);
    registerSidebarButton(() => this.data.paneKey);

    Zotero.debug(`[${config.addonName}] Ready`);
  }

  public onMainWindowLoad(win: Window) {
    if ((win as any).MozXULElement) {
      (win as any).MozXULElement.insertFTLIfNeeded(`${config.addonRef}.ftl`);
    }
  }

  public getSession(key: string): ChatMessage[] {
    if (!this.data.sessions[key]) {
      this.data.sessions[key] = [];
    }
    return this.data.sessions[key];
  }

  public pushMessage(key: string, message: ChatMessage) {
    const session = this.getSession(key);
    session.push(message);
  }

  public setBusy(key: string, value: boolean) {
    this.data.busy[key] = value;
  }

  public isBusy(key: string): boolean {
    return !!this.data.busy[key];
  }
}

export default Addon;

