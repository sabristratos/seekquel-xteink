import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const PLUGIN_DIR = path.join(ROOT, "seekquel");
const SOURCE = fs.readFileSync(path.join(PLUGIN_DIR, "plugin.js"), "utf8");
const INSTALL_DIR = "/.crosspoint/plugins/seekquel";

class FakeElement {
  constructor(tagName) {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.listeners = {};
    this.attributes = {};
    this.textContent = "";
    this.value = "";
    this.type = "";
    this.name = "";
    this.href = "";
    this.checked = false;
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }

  replaceChildren(...children) {
    this.children = children;
  }

  addEventListener(type, handler) {
    this.listeners[type] = handler;
  }

  setAttribute(name, value) {
    this.attributes[name] = value;
  }
}

function nodes(root) {
  return [root, ...root.children.flatMap(nodes)];
}

function json(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

export function defaultSettings(overrides = {}) {
  return {
    koServerUrl: "",
    koUsername: "",
    koPassword: "",
    koServerType: 1,
    koMatchMethod: 0,
    koSendMetadata: 0,
    koSyncBehavior: 1,
    koSyncClippings: 0,
    ...overrides,
  };
}

export async function settle() {
  for (let index = 0; index < 20; index += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

export async function mount({ settings = defaultSettings(), config = null, status = {}, relay } = {}) {
  const files = new Map();
  files.set("manifest.json", fs.readFileSync(path.join(PLUGIN_DIR, "manifest.json"), "utf8"));
  if (config !== null) files.set("config.json", JSON.stringify(config));

  const deviceSettings = { ...settings };
  const settingsPosts = [];
  const relays = [];
  const timers = [];
  const container = new FakeElement("div");
  let registered;

  const fetch = async (url, options = {}) => {
    const method = options.method || "GET";
    if (url === "/api/status") return json({ version: "1.7.0", mode: "STA", device: "X4", uptime: 600, ...status });
    if (url === "/api/settings" && method === "GET") {
      return json(Object.entries(deviceSettings).map(([key, value]) => ({ key, value })));
    }
    if (url === "/api/settings" && method === "POST") {
      const update = JSON.parse(options.body);
      settingsPosts.push(update);
      Object.assign(deviceSettings, update);
      return json({});
    }
    const file = new URL(url, "http://reader.local").searchParams.get("file");
    if (url.startsWith("/plugin?") && files.has(file)) return json(JSON.parse(files.get(file)));
    return json({}, 404);
  };

  const api = {
    name: "seekquel",
    dir: INSTALL_DIR,
    pluginFile: (file) => `/plugin?name=seekquel&file=${encodeURIComponent(file)}`,
    writeFile: async (target, base64) => {
      if (!target.startsWith(`${INSTALL_DIR}/`)) throw new Error(`write outside the plugin folder: ${target}`);
      files.set(target.slice(INSTALL_DIR.length + 1), Buffer.from(base64, "base64").toString("utf8"));
      return { ok: true };
    },
    relay: async (method, url, headers, body) => {
      relays.push({ method, url, headers, body: body ? JSON.parse(body) : null });
      return relay(method, url, headers, body);
    },
  };

  const context = vm.createContext({
    CrossPoint: { registerPlugin: (fn) => (registered = fn) },
    document: { createElement: (tag) => new FakeElement(tag) },
    fetch,
    setTimeout: (fn) => {
      timers.push(fn);
      return timers.length;
    },
    clearTimeout: () => {},
    TextEncoder,
    btoa: (value) => Buffer.from(value, "binary").toString("base64"),
    Date,
    JSON,
    Number,
    Object,
    String,
    Array,
    console,
  });

  vm.runInContext(SOURCE, context);
  registered(container, api);
  await settle();

  return {
    container,
    files,
    deviceSettings,
    settingsPosts,
    relays,
    text: () => nodes(container).map((node) => node.textContent).filter(Boolean).join("\n"),
    button(label) {
      const found = nodes(container).find((node) => node.tagName === "BUTTON" && node.textContent === label);
      if (!found) throw new Error(`no button "${label}" in:\n${this.text()}`);
      return found;
    },
    find(predicate) {
      return nodes(container).find(predicate);
    },
    async click(label) {
      await this.button(label).listeners.click();
      await settle();
    },
    async runTimers() {
      while (timers.length > 0) {
        await timers.shift()();
        await settle();
      }
    },
    fileJson(name) {
      return JSON.parse(files.get(name));
    },
  };
}
