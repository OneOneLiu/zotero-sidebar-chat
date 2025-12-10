import MarkdownIt from "markdown-it";
// @ts-ignore
import tm from "markdown-it-texmath";
import katex from "katex";
import { config } from "../../package.json";
import Addon, { ChatMessage } from "../addon";
import { buildEndpoint, getSettings } from "./settings";
import { getLocaleID } from "../utils/locale";

Zotero.debug("[GeminiChat] Loading readerPane module...");

let md: any = null;

function getMarkdown() {
  if (!md) {
    try {
      Zotero.debug("[GeminiChat] Initializing MarkdownIt...");
      md = new MarkdownIt({
        xhtmlOut: true, // Use '/' to close single tags (<br />)
        html: true,
        linkify: true,
        typographer: true,
      });

      Zotero.debug("[GeminiChat] Initializing TexMath...");
      md.use(tm, {
        engine: katex,
        delimiters: "dollars",
        katexOptions: {
          macros: { "\\RR": "\\mathbb{R}" },
          output: "html", // Prevent MathML/HTML duplication
          throwOnError: false
        },
      });
      Zotero.debug("[GeminiChat] MarkdownIt initialized success.");
    } catch (e) {
      Zotero.debug(`[GeminiChat] Failed to init Markdown: ${e}`);
      md = {
        render: (text: string) => text,
      };
    }
  }
  return md;
}

type RenderOptions = {
  body: HTMLElement;
  item: Zotero.Item;
};

export function registerReaderPane(addon: Addon): string {
  const paneKey =
    Zotero.ItemPaneManager.registerSection({
      paneID: "gemini-chat",
      pluginID: config.addonID,
      header: {
        l10nID: getLocaleID("section-header"),
        icon: `chrome://${config.addonRef}/content/icons/gemini.svg`,
      },
      sidenav: {
        l10nID: getLocaleID("section-sidenav"),
        icon: `chrome://${config.addonRef}/content/icons/gemini.svg`,
        // @ts-ignore - orderable exists on ItemPaneManager sections
        orderable: false,
      },
      bodyXHTML: `<div class="gemini-chat-body"></div>`,
      onRender: ({ body, item }: RenderOptions) => {
        renderChat(body, item, addon);
      },
      onItemChange: ({ tabType, body, item, setEnabled }) => {
        const enabled = tabType === "reader";
        setEnabled(enabled);
        if (enabled) {
          renderChat(body, item, addon);
        } else {
          body.innerHTML = "";
        }
        return true;
      },
    }) || "";

  return paneKey;
}

export function registerSidebarButton(getPaneKey: () => string) {
  Zotero.Reader.registerEventListener(
    "renderSidebarAnnotationHeader",
    (event) => {
      const { doc, append } = event;
      if (doc.getElementById("gemini-chat-sidebar-button")) return;

      const btn = doc.createElementNS(
        "http://www.w3.org/1999/xhtml",
        "button",
      );
      btn.id = "gemini-chat-sidebar-button";
      btn.className = "gemini-chat-jump";
      btn.textContent = "Gemini";
      btn.setAttribute("data-l10n-id", getLocaleID("sidebar-button"));

      btn.title = "Open Gemini chat pane";
      btn.style.cssText =
        "border:1px solid transparent;border-radius:4px;padding:2px 6px;cursor:pointer;background:var(--color-field-bg, #ececec);";
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const paneKey = getPaneKey();
        if (!paneKey) {
          return;
        }
        const details = doc.querySelector("item-details") as any;
        if (details?.scrollToPane) {
          details.scrollToPane(paneKey);
        }
      });
      append(btn);
    },
    config.addonID,
  );
}

function renderChat(body: HTMLElement, item: Zotero.Item, addon: Addon) {
  Zotero.debug(`[GeminiChat] renderChat called for item ${item?.id}`);

  try {
    const itemKey = item?.id ? String(item.id) : "global";
    const messages = addon.getSession(itemKey);
    const doc = body.ownerDocument;
    const HTML_NS = "http://www.w3.org/1999/xhtml";

    const createElement = (tagName: string) => {
      return doc.createElementNS(HTML_NS, tagName) as HTMLElement;
    };

    // Safely get head
    const head = doc.head || doc.getElementsByTagName("head")[0] || doc.documentElement;

    // Inject CSS
    try {
      if (!doc.getElementById("gemini-chat-styles")) {
        const style = createElement("style");
        style.id = "gemini-chat-styles";
        style.textContent = `
          .gemini-chat-wrapper {
            display: flex;
            flex-direction: column;
            height: 100%;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background-color: var(--color-background, #fff);
            color: var(--color-text, #000);
          }
          .gemini-chat-header {
            padding: 12px;
            border-bottom: 1px solid var(--color-border, #e0e0e0);
            display: flex;
            flex-direction: column;
            gap: 8px;
            background: var(--color-background, #fff);
            border-radius: 12px 12px 0 0;
          }
          .gemini-chat-title-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 8px;
          }
          .gemini-chat-title-group {
            display: flex;
            align-items: center;
            gap: 8px;
            flex: 1;
          }
          .gemini-chat-title {
            font-weight: 600;
            font-size: 14px;
          }
          .gemini-chat-model-select {
            font-size: 11px;
            padding: 2px 6px;
            border: 1px solid var(--color-border, #ccc);
            border-radius: 4px;
            max-width: 280px;
            min-width: 200px;
            background-color: var(--color-field-bg, #fff);
            color: var(--color-text, #000);
          }
          .gemini-chat-subtitle {
            font-size: 11px;
            color: var(--color-secondary-label, #666);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .gemini-chat-prompts {
            display: flex;
            gap: 6px;
            overflow-x: auto;
            padding-bottom: 4px;
            scrollbar-width: none;
          }
          .gemini-chat-prompt-chip {
            white-space: nowrap;
            padding: 4px 10px;
            font-size: 11px;
            border: 1px solid var(--color-border, #e0e0e0);
            border-radius: 12px;
            background: var(--color-field-bg, #f5f5f5);
            cursor: pointer;
            transition: all 0.2s;
            color: var(--color-text, #333);
          }
          .gemini-chat-prompt-chip:hover {
            background: var(--color-selection, #e8f0fe);
            border-color: var(--color-selection, #d2e3fc);
            color: var(--color-primary, #1a73e8);
          }
          .gemini-chat-messages {
            flex: 1;
            overflow-y: auto;
            padding: 12px;
            background-color: var(--color-background, #fff);
            display: flex;
            flex-direction: column;
            gap: 12px;
          }
          .gemini-chat-bubble {
            max-width: 85%;
            padding: 8px 12px;
            border-radius: 12px;
            position: relative;
            font-size: 13px;
            line-height: 1.5;
            word-wrap: break-word;
            user-select: text;
            -webkit-user-select: text;
            -moz-user-select: text;
            cursor: text;
          }
          .gemini-chat-bubble.user {
            align-self: flex-end;
            background-color: #007aff;
            color: white;
            border-bottom-right-radius: 2px;
          }
          .gemini-chat-bubble.model {
            align-self: flex-start;
            background-color: var(--color-field-bg, #f1f3f4);
            color: var(--color-text, #000);
            border-bottom-left-radius: 2px;
          }
          .gemini-chat-bubble.system {
            align-self: center;
            background-color: var(--color-warning-bg, #fff3cd);
            color: var(--color-warning-text, #856404);
            font-size: 11px;
            padding: 4px 8px;
          }
          .gemini-chat-bubble p {
            margin: 0 0 8px 0;
          }
          .gemini-chat-bubble p:last-child {
            margin: 0;
          }
          .gemini-chat-save-btn {
            position: absolute;
            top: -6px;
            left: -8px;
            width: 20px;
            height: 20px;
            background: white;
            border: 1px solid #ddd;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            font-size: 12px;
            color: #666;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            opacity: 0;
            transition: opacity 0.2s;
          }
          .gemini-chat-bubble:hover .gemini-chat-save-btn {
            opacity: 1;
          }
          .gemini-chat-input-area {
            padding: 12px;
            border-top: 1px solid var(--color-border, #e0e0e0);
            background: var(--color-background, #fff);
            display: flex;
            flex-direction: column;
            gap: 6px;
          }
          .gemini-chat-input-row {
            display: flex;
            gap: 8px;
            align-items: flex-end;
          }
          .gemini-chat-textarea {
            flex: 1;
            border: 1px solid var(--color-border, #ccc);
            border-radius: 18px;
            padding: 8px 12px;
            font-family: inherit;
            font-size: 13px;
            resize: none;
            min-height: 20px;
            max-height: 100px;
            outline: none;
            background-color: var(--color-field-bg, #fff);
            color: var(--color-text, #000);
          }
          .gemini-chat-textarea:focus {
            border-color: #007aff;
          }
          .gemini-chat-send-btn {
            background-color: transparent;
            color: #007aff;
            border: none;
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            font-size: 20px;
            transition: transform 0.1s;
            padding: 0;
            line-height: 1;
          }
          .gemini-chat-send-btn:hover {
            transform: scale(1.1);
            background-color: transparent;
          }
          .gemini-chat-send-btn:disabled {
            color: #ccc;
            cursor: default;
            transform: none;
          }
          .gemini-chat-spinner {
            width: 16px;
            height: 16px;
            border: 2px solid #ccc;
            border-top-color: #007aff;
            border-radius: 50%;
            animation: gemini-chat-spin 1s linear infinite;
          }
          @keyframes gemini-chat-spin {
            to { transform: rotate(360deg); }
          }
          .gemini-chat-hint {
            font-size: 10px;
            color: var(--color-secondary-label, #888);
            text-align: center;
          }
         .gemini-chat-bubble.loading {
            background-color: var(--color-field-bg, #f1f3f4);
            color: var(--color-secondary-label, #888);
            border-bottom-left-radius: 2px;
            display: flex;
            align-items: center;
            gap: 4px;
            padding: 12px 16px;
            width: fit-content;
          }
          .gemini-chat-dot {
            width: 6px;
            height: 6px;
            background-color: #888;
            border-radius: 50%;
            animation: gemini-chat-bounce 1.4s infinite ease-in-out both;
          }
          .gemini-chat-dot:nth-child(1) { animation-delay: -0.32s; }
          .gemini-chat-dot:nth-child(2) { animation-delay: -0.16s; }
          
          @keyframes gemini-chat-bounce {
            0%, 80%, 100% { transform: scale(0); }
            40% { transform: scale(1); }
          }
          .gemini-chat-meta {
            font-size: 9px;
            color: var(--color-secondary-label, #999);
            margin-top: 4px;
            text-align: right;
            opacity: 0.8;
          }
        `;
        head.appendChild(style);
      }

      // Inject Katex CSS if missing
      if (!doc.getElementById("katex-css")) {
        const link = createElement("link") as HTMLLinkElement;
        link.id = "katex-css";
        link.setAttribute("rel", "stylesheet");
        link.setAttribute("href", `chrome://${config.addonRef}/content/style/katex.min.css`);
        head.appendChild(link);
      }
    } catch (e) {
      Zotero.debug(`[GeminiChat] CSS Inject Error: ${e}`);
    }

    body.innerHTML = "";

    const wrapper = createElement("div");
    wrapper.setAttribute("class", "gemini-chat-wrapper");

    // --- Header ---
    const header = createElement("div");
    header.setAttribute("class", "gemini-chat-header");

    const titleRow = createElement("div");
    titleRow.setAttribute("class", "gemini-chat-title-row");

    const titleGroup = createElement("div");
    titleGroup.setAttribute("class", "gemini-chat-title-group");

    const title = createElement("div");
    title.textContent = "Gemini";
    title.setAttribute("class", "gemini-chat-title");

    const modelSelect = createElement("select") as HTMLSelectElement;
    modelSelect.setAttribute("class", "gemini-chat-model-select");

    const models = [
      "gemini-3-pro-preview",
      "gemini-2.5-flash",
      "gemini-2.5-flash-lite",
      "gemini-2.5-pro"
    ];

    let currentSettings: any = {};
    try {
      currentSettings = getSettings();
    } catch (e) {
      Zotero.debug(`[GeminiChat] Error getting settings: ${e}`);
    }

    models.forEach(m => {
      const opt = createElement("option") as HTMLOptionElement;
      opt.value = m;
      opt.textContent = m.replace("gemini-", "");
      if (m === currentSettings.model) {
        opt.selected = true;
      }
      modelSelect.appendChild(opt);
    });

    modelSelect.addEventListener("change", () => {
      const val = modelSelect.value;
      Zotero.Prefs.set(config.prefsPrefix + ".model", val, true);
    });

    titleGroup.appendChild(title);
    titleGroup.appendChild(modelSelect);

    const saveAllBtn = createElement("button");
    saveAllBtn.textContent = "+";
    saveAllBtn.title = "Save whole chat to note";
    saveAllBtn.style.background = "white";
    saveAllBtn.style.border = "1px solid #ddd";
    saveAllBtn.style.borderRadius = "50%";
    saveAllBtn.style.width = "20px";
    saveAllBtn.style.height = "20px";
    saveAllBtn.style.display = "flex";
    saveAllBtn.style.alignItems = "center";
    saveAllBtn.style.justifyContent = "center";
    saveAllBtn.style.cursor = "pointer";
    saveAllBtn.style.fontSize = "14px";
    saveAllBtn.style.color = "#666";

    saveAllBtn.onclick = async () => {
      saveAllBtn.textContent = "...";
      await saveFullSessionToNote(item, messages);
      saveAllBtn.textContent = "✔";
      setTimeout(() => (saveAllBtn.textContent = "+"), 2000);
    };

    titleRow.appendChild(titleGroup);
    titleRow.appendChild(saveAllBtn);
    header.appendChild(titleRow);

    const subtitle = createElement("div");
    subtitle.setAttribute("class", "gemini-chat-subtitle");
    subtitle.textContent = item?.getField?.("title")
      ? item.getField("title")
      : "Select a PDF tab to chat";
    header.appendChild(subtitle);

    // --- Prompts ---
    let prompts: Array<{ name: string, prompt: string }> = [];
    try {
      if (currentSettings.customPrompts) {
        prompts = JSON.parse(currentSettings.customPrompts);
      }
    } catch (e) {
      Zotero.debug(`[GeminiChat] Error parsing prompts: ${e}`);
    }

    if (prompts.length > 0 && Array.isArray(prompts)) {
      const promptBar = createElement("div");
      promptBar.setAttribute("class", "gemini-chat-prompts");

      prompts.forEach(p => {
        if (!p.name || !p.prompt) return;
        const chip = createElement("button");
        chip.setAttribute("class", "gemini-chat-prompt-chip");
        chip.textContent = p.name;
        chip.title = p.prompt;
        chip.onclick = () => handleSend(p.prompt);
        promptBar.appendChild(chip);
      });
      header.appendChild(promptBar);
    }

    // --- Messages ---
    const messageList = createElement("div");
    messageList.setAttribute("class", "gemini-chat-messages");

    // --- Input ---
    const inputArea = createElement("div");
    inputArea.setAttribute("class", "gemini-chat-input-area");

    const inputRow = createElement("div");
    inputRow.setAttribute("class", "gemini-chat-input-row");

    const input = createElement("textarea") as HTMLTextAreaElement;
    input.setAttribute("class", "gemini-chat-textarea");
    input.placeholder = "Ask a question...";
    input.rows = 1;

    input.addEventListener("input", () => {
      input.style.height = "auto";
      input.style.height = (input.scrollHeight) + "px";
    });

    const sendBtn = createElement("button") as HTMLButtonElement;
    sendBtn.setAttribute("class", "gemini-chat-send-btn");
    sendBtn.textContent = "➤";
    sendBtn.title = "Send";

    const hint = createElement("div");
    hint.setAttribute("class", "gemini-chat-hint");
    hint.textContent = "Enter to send, Shift+Enter for new line";

    inputRow.appendChild(input);
    inputRow.appendChild(sendBtn);
    inputArea.appendChild(inputRow);
    inputArea.appendChild(hint);

    wrapper.appendChild(header);
    wrapper.appendChild(messageList);
    wrapper.appendChild(inputArea);
    body.appendChild(wrapper);

    const renderMessages = () => {
      messageList.innerHTML = "";
      messages.forEach((m, index) => {
        const bubble = createElement("div");
        bubble.setAttribute("class", `gemini-chat-bubble ${m.role}`);

        if (m.role === "user") {
          const saveBtn = createElement("button");
          saveBtn.textContent = "+";
          saveBtn.title = "Save this request to note";
          saveBtn.setAttribute("class", "gemini-chat-save-btn");

          saveBtn.onclick = async (e) => {
            e.stopPropagation();
            const nextMsg = messages[index + 1];
            const answer = nextMsg?.role === "model" ? nextMsg.text : "";
            saveBtn.textContent = "...";
            await saveToNote(item, m.text, answer);
            saveBtn.textContent = "✔";
            setTimeout(() => (saveBtn.textContent = "+"), 2000);
          };
          bubble.appendChild(saveBtn);
        }

        try {
          const content = createElement("div");
          // Initialize md if needed
          const mdInstance = getMarkdown();
          content.innerHTML = mdInstance.render(m.text);
          bubble.appendChild(content);
        } catch (e) {
          bubble.textContent = m.text;
        }

        if (m.meta && m.meta.duration) {
          const meta = createElement("div");
          meta.setAttribute("class", "gemini-chat-meta");
          meta.textContent = `${(m.meta.duration / 1000).toFixed(1)}s`;
          bubble.appendChild(meta);
        }

        messageList.appendChild(bubble);
      });

      // Show loading indicator if busy
      if (addon.isBusy(itemKey)) {
        const loadingBubble = createElement("div");
        loadingBubble.setAttribute("class", "gemini-chat-bubble model loading");
        loadingBubble.innerHTML = `
          <div class="gemini-chat-dot"></div>
          <div class="gemini-chat-dot"></div>
          <div class="gemini-chat-dot"></div>
        `;
        messageList.appendChild(loadingBubble);
      }

      messageList.scrollTop = messageList.scrollHeight;
    };

    renderMessages();

    const setBusy = (busy: boolean) => {
      addon.setBusy(itemKey, busy);
      sendBtn.disabled = busy;
      input.disabled = busy;

      if (busy) {
        sendBtn.innerHTML = ""; // Clear emoji
        const spinner = createElement("div");
        spinner.className = "gemini-chat-spinner";
        sendBtn.appendChild(spinner);
        sendBtn.title = "Asking...";
      } else {
        sendBtn.textContent = "➤";
        sendBtn.title = "Send";
      }
    };

    // Initial sync
    setBusy(addon.isBusy(itemKey));

    const handleSend = async (overrideText?: string) => {
      const text = (typeof overrideText === "string" ? overrideText : input.value).trim();
      if (!text || addon.isBusy(itemKey)) return;

      addon.pushMessage(itemKey, {
        role: "user",
        text,
        at: Date.now(),
      });

      if (!overrideText) {
        input.value = "";
        input.style.height = "auto";
      }
      renderMessages();

      const settings = getSettings();
      if (!settings.apiKey) {
        addon.pushMessage(itemKey, {
          role: "system",
          text: "Missing API key. Set it in Preferences -> Gemini Chat.",
          at: Date.now(),
        });
        renderMessages();
        return;
      }

      setBusy(true);
      const startTime = Date.now();
      try {
        const history = addon.getSession(itemKey);
        const pdfPart = await getPdfContextPart(item);

        const contents = history.map((msg, index) => {
          const parts: any[] = [{ text: msg.text }];
          if (index === 0 && msg.role === "user") {
            if (pdfPart) parts.unshift({ inlineData: pdfPart });
            if (item?.getField) {
              const title = item.getField("title") || "";
              parts[parts.length - 1].text = `Paper title: ${title}\n\n${parts[parts.length - 1].text}`;
            }
          }
          return { role: msg.role, parts: parts };
        });

        const reply = await callGemini(settings, contents);
        const duration = Date.now() - startTime;

        addon.pushMessage(itemKey, {
          role: "model",
          text: reply,
          at: Date.now(),
          meta: { duration }
        });
      } catch (e: any) {
        addon.pushMessage(itemKey, {
          role: "system",
          text: `Gemini error: ${e?.message || e}`,
          at: Date.now(),
        });
      } finally {
        setBusy(false);
        renderMessages();
      }
    };

    sendBtn.onclick = () => handleSend();
    input.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" && !ev.shiftKey) {
        ev.preventDefault();
        handleSend();
      }
    });

  } catch (error: any) {
    Zotero.debug(`[GeminiChat] Render error: ${error}\n${error?.stack}`);
    body.textContent = `Error rendering chat pane: ${error?.message || error}`;
  }
}

async function saveFullSessionToNote(item: Zotero.Item, messages: ChatMessage[]) {
  const parentID = item.isAttachment() ? item.parentID : item.id;
  if (!parentID) return;

  const note = new Zotero.Item("note");
  note.parentID = parentID;

  let html = `<h2>Gemini Chat Session (${new Date().toLocaleString()})</h2>`;

  messages.forEach(m => {
    const role = m.role === "user" ? "User" : (m.role === "model" ? "Gemini" : "System");

    // Use getMarkdown().render for formatting
    let content = "";
    try {
      content = getMarkdown().render(m.text);
    } catch (e) {
      content = m.text; // Fallback
    }

    html += `<p><strong>${role}:</strong></p>
    ${content}
    <hr/>`;
  });

  note.setNote(html);
  await note.saveTx();
  Zotero.debug(`[GeminiChat] Full chat saved to item ${parentID}`);
}

async function saveToNote(item: Zotero.Item, question: string, answer: string) {
  const parentID = item.isAttachment() ? item.parentID : item.id;
  if (!parentID) {
    Zotero.debug("[GeminiChat] Cannot save note: No parent item found.");
    return;
  }

  const note = new Zotero.Item("note");
  note.parentID = parentID;

  // Format content
  const qHtml = getMarkdown().render(question);
  const aHtml = getMarkdown().render(answer);

  note.setNote(`<h2>Gemini Chat</h2>
<p><strong>User:</strong></p>
${qHtml}
<hr/>
<p><strong>Gemini:</strong></p>
${aHtml}`);

  await note.saveTx();
  Zotero.debug(`[GeminiChat] Note saved to item ${parentID}`);
}

async function getPdfContextPart(item: Zotero.Item): Promise<{ mimeType: string; data: string } | null> {
  const attachment = getBestAttachment(item);
  if (!attachment) return null;

  const path = await attachment.getFilePathAsync();
  if (!path) return null;

  try {
    const data = await getFileData(path);
    if (data) {
      return {
        mimeType: "application/pdf",
        data
      };
    }
  } catch (e) {
    Zotero.debug(`[GeminiChat] Failed to read PDF: ${e}`);
  }
  return null;
}

function getBestAttachment(item: Zotero.Item): Zotero.Item | null {
  if (item.isAttachment()) return item;
  if (item.isRegularItem()) {
    const attachmentIDs = item.getAttachments();
    for (const id of attachmentIDs) {
      const att = Zotero.Items.get(id);
      if (att && !att.isNote() && att.attachmentContentType === 'application/pdf') {
        return att;
      }
    }
  }
  return null;
}

async function getFileData(path: string): Promise<string | null> {
  if (typeof IOUtils !== "undefined") {
    try {
      const bytes = await IOUtils.read(path);
      return arrayBufferToBase64(bytes);
    } catch (e) {
      Zotero.debug(`[GeminiChat] IOUtils read failed: ${e}`);
    }
  }

  // @ts-ignore
  if (typeof OS !== "undefined" && OS.File) {
    try {
      // @ts-ignore
      const bytes = await OS.File.read(path);
      return arrayBufferToBase64(bytes);
    } catch (e) {
      Zotero.debug(`[GeminiChat] OS.File read failed: ${e}`);
    }
  }

  return null;
}

function arrayBufferToBase64(buffer: Uint8Array | ArrayBuffer | any): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const len = bytes.byteLength;
  const chunkSize = 8192;
  for (let i = 0; i < len; i += chunkSize) {
    const end = Math.min(i + chunkSize, len);
    const chunk = bytes.subarray(i, end);
    // @ts-ignore
    binary += String.fromCharCode.apply(null, chunk);
  }
  return btoa(binary);
}

async function callGemini(settings: ReturnType<typeof getSettings>, contents: any[]): Promise<string> {
  const endpoint = buildEndpoint(settings);
  const payload = {
    contents: contents,
  };

  let signal: AbortSignal | undefined;
  let timer: any;

  if (typeof AbortController !== "undefined") {
    const controller = new AbortController();
    timer = setTimeout(() => controller.abort(), 60000);
    signal = controller.signal;
  }

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: signal,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`${res.status} ${res.statusText}: ${text}`);
    }
    const data: any = await res.json();
    const content: string =
      data?.candidates?.[0]?.content?.parts
        ?.map((p: { text?: string }) => p.text)
        .filter(Boolean)
        .join("\n")
        ?.trim() || "No response";
    return content;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
