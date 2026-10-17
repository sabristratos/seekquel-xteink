"use strict";

CrossPoint.registerPlugin((container, api) => {
  const SERVER = "https://api.seekquel.app/koreader";
  const SERVER_ADDRESS = "api.seekquel.app/koreader";
  const CLIENT = "xteink";
  const WIRE_CLIENT = "crosspoint-reader";
  const PLACEHOLDER_PASSWORD = "seekquel";
  const CONFIG_FILE = "config.json";
  const DEVICE_FILE = "device.json";
  const MANIFEST_FILE = "manifest.json";
  const KOREADER_ACCEPT = "application/vnd.koreader.v1+json";
  const JSON_TYPE = "application/json";
  const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;
  const HOTSPOT_MODE = "AP";
  const MILLISECONDS_PER_SECOND = 1000;
  const SLOW_DOWN_SECONDS = 5;
  const DEFAULT_POLL_SECONDS = 5;
  const HTTP_OK = 200;
  const HTTP_CREATED = 201;
  const HTTP_UNAUTHORIZED = 401;
  const SERVER_TYPE_OTHER = 2;
  const MATCH_BINARY = 1;
  const ON = 1;
  const OFF = 0;
  const TITLE = "Seekquel";
  const PRIMARY = "btn-small btn-add";
  const SECONDARY = "btn-small";
  const DANGER = "btn-small btn-delete";
  const CARD_STYLE =
    ".seekquel-actions{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:12px}" +
    ".seekquel-code{font-size:1.6em;font-weight:600;letter-spacing:0.08em;margin:8px 0}" +
    ".seekquel-actions a{text-decoration:none;display:inline-flex;align-items:center;box-sizing:border-box}";
  const IDLE_DESCRIPTION = "Logs your reading time in Seekquel. Connect it from this reader's web page, under Settings.";
  const ACTIVE_DESCRIPTION = "Sends your reading time to Seekquel.";
  const SETTING = {
    url: "koServerUrl",
    username: "koUsername",
    password: "koPassword",
    serverType: "koServerType",
    match: "koMatchMethod",
    metadata: "koSendMetadata",
    clippings: "koSyncClippings",
  };
  const PAIRING_STOPPED = {
    access_denied: "denied",
    expired_token: "expired",
    invalid_grant: "expired",
  };

  const TEXT = {
    intro:
      "Seekquel logs the time you spend reading on this Xteink, and how far each sitting took you, in your Seekquel account. Your place in a book still moves when you choose Sync Progress on the reader.",
    connect: "Connect to Seekquel",
    adoptBody: "This reader already syncs its place with your Seekquel account.",
    adopt: "Use that account",
    hotspot:
      "This reader is in hotspot mode, so it cannot reach the internet. Join a Wi-Fi network on the reader, then open this page again.",
    starting: "Asking Seekquel for a code…",
    codeHeading: "Your code",
    codeBody:
      "Open Seekquel on your phone or computer and enter this code. The button below opens the right page with the code filled in.",
    approve: "Open Seekquel",
    waiting: "Waiting for you to tap Connect in Seekquel.",
    cancel: "Cancel",
    expired: "The code expired. Start again for a new one.",
    denied: "The code was declined in Seekquel. Start again if that was a mistake.",
    unreachable:
      "Your reader could not reach Seekquel. Check it is on a Wi-Fi network with internet access, then try again.",
    unexpected: "Seekquel did not answer as expected. Try again in a minute.",
    connected: "Connected to Seekquel",
    sendsOnSleep:
      "When you finish reading, your reader sends the time and how far you got as it goes to sleep. It turns Wi-Fi on for a few seconds to do it, and waits when the battery is under 20%.",
    sendsOnWifi: "Reading time is sent the next time this reader is on Wi-Fi.",
    sleepToggle: "Send when the reader goes to sleep",
    leaveTransfer: "Sending starts when you leave File Transfer on the reader.",
    check: "Check connection",
    checking: "Checking…",
    checkOk: "Seekquel answered. Your reading time will arrive in your library.",
    keyRevoked:
      "Seekquel no longer accepts this reader's key. It may have been removed in the app. Disconnect, then connect again.",
    elsewhere:
      "Your place in a book syncs with {server}, not Seekquel. Your reading time still goes to Seekquel, and a book it has not seen before waits in the app, under Books from your reader, until you say which book it is. Matching books by their contents applies to {server} too, so your other devices that sync with it need the same setting to find your place.",
    syncHere: "Sync my place with Seekquel instead",
    fixHeading: "Some sync settings on this reader need changing",
    fix: "Fix sync settings",
    fixed: "Sync settings updated.",
    fixFailed:
      "This reader did not take the new settings. Set them in the reader's KOReader Sync menu instead.",
    disconnect: "Disconnect",
    disconnected:
      "Disconnected. This reader no longer sends reading time. Its place in a book still syncs with Sync Progress until you remove it in Seekquel, under Settings, Integrations.",
    saveFailed:
      "This reader could not save to its memory card. Check the card is in and has space, then try again.",
    loadFailed: "This page could not read the plugin's files. Reinstall the plugin and reload the page.",
  };

  const PROBLEMS_WHEN_ELSEWHERE = ["match"];

  const PROBLEMS = {
    url: "The sync server is not Seekquel's.",
    username: "The sync username is not this reader's Seekquel key.",
    match: "Books are matched by file name, so the same book on two devices would count as two.",
    metadata: "Book titles are not sent, so Seekquel cannot tell which book a file is.",
    serverType: "The server type is not Other, so the exact spot in a book is not kept.",
    clippings: "Clippings sync is on, and Seekquel does not take clippings yet, so every sync would report a failure.",
  };

  let version = null;
  let config = {};
  let settings = {};
  let status = {};
  let pairing = null;

  function element(tag, text) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function button(text, onClick, className) {
    const node = element("button", text);
    node.type = "button";
    node.className = className || SECONDARY;
    node.addEventListener("click", onClick);
    return node;
  }

  function actions(...nodes) {
    const row = element("div");
    row.className = "seekquel-actions";
    for (const node of nodes) row.appendChild(node);
    return row;
  }

  function show(...nodes) {
    const style = element("style", CARD_STYLE);
    container.replaceChildren(style, element("h2", TITLE), ...nodes);
  }

  function message(text) {
    const node = element("p", text);
    node.setAttribute("role", "status");
    return node;
  }

  function encode(value) {
    const bytes = new TextEncoder().encode(value);
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
  }

  function pluginPath(name) {
    return `${api.dir}/${name}`;
  }

  async function writeJson(name, value) {
    await api.writeFile(pluginPath(name), encode(`${JSON.stringify(value, null, 2)}\n`));
  }

  async function readJson(url) {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return null;
    return response.json();
  }

  function normalizedAddress(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/\/+$/, "");
  }

  function isSeekquel(address) {
    return normalizedAddress(address) === SERVER_ADDRESS;
  }

  function parseBody(response) {
    try {
      return JSON.parse(response.body || "null");
    } catch (_error) {
      return null;
    }
  }

  function sessionBody() {
    return (
      '{"document":"{event.document}","start_time":{event.start_time},"end_time":{event.end_time},' +
      '"duration_seconds":{event.duration_seconds},"start_progress_bp":{event.start_progress_bp},' +
      '"end_progress_bp":{event.end_progress_bp},"progress_scale":{event.progress_scale},' +
      `"event_id":"{event.id}","client":"${WIRE_CLIENT}","plugin_version":"${version}"}`
    );
  }

  function eventsManifest(sendOnSleep) {
    return {
      title: TITLE,
      description: ACTIVE_DESCRIPTION,
      config: { file: CONFIG_FILE },
      events: {
        "reader.session": {
          request: {
            method: "POST",
            url: "{cfg.server}/reading-sessions",
            headers: {
              "Content-Type": JSON_TYPE,
              Accept: KOREADER_ACCEPT,
              "x-auth-user": "{cfg.key}",
              "X-Book-Path": "{event.book}",
            },
            body: sessionBody(),
          },
          connect: sendOnSleep,
        },
      },
    };
  }

  function idleManifest() {
    return { title: TITLE, description: IDLE_DESCRIPTION };
  }

  async function loadSettings() {
    const list = await readJson("/api/settings");
    settings = {};
    for (const item of Array.isArray(list) ? list : []) {
      if (item && typeof item.key === "string") settings[item.key] = item.value;
    }
  }

  function has(key) {
    return Object.prototype.hasOwnProperty.call(settings, key);
  }

  function wantedSettings(key) {
    return {
      [SETTING.url]: config.server || SERVER,
      [SETTING.username]: key,
      [SETTING.password]: PLACEHOLDER_PASSWORD,
      [SETTING.serverType]: SERVER_TYPE_OTHER,
      [SETTING.match]: MATCH_BINARY,
      [SETTING.metadata]: ON,
      [SETTING.clippings]: OFF,
    };
  }

  function otherSyncServer() {
    if (!has(SETTING.url)) return null;
    const address = normalizedAddress(settings[SETTING.url]);
    return address !== "" && address !== normalizedAddress(config.server) ? address : null;
  }

  function settingProblems() {
    const problems = [];
    if (has(SETTING.url) && normalizedAddress(settings[SETTING.url]) !== normalizedAddress(config.server)) problems.push("url");
    if (has(SETTING.username) && settings[SETTING.username] !== config.key) problems.push("username");
    if (has(SETTING.match) && Number(settings[SETTING.match]) !== MATCH_BINARY) problems.push("match");
    if (has(SETTING.metadata) && Number(settings[SETTING.metadata]) !== ON) problems.push("metadata");
    if (has(SETTING.serverType) && Number(settings[SETTING.serverType]) !== SERVER_TYPE_OTHER) problems.push("serverType");
    if (has(SETTING.clippings) && Number(settings[SETTING.clippings]) !== OFF) problems.push("clippings");
    return otherSyncServer() ? problems.filter((problem) => PROBLEMS_WHEN_ELSEWHERE.includes(problem)) : problems;
  }

  async function applySettings(key, only) {
    const wanted = wantedSettings(key);
    const update = {};
    for (const name of only || Object.keys(SETTING)) {
      if (has(SETTING[name])) update[SETTING[name]] = wanted[SETTING[name]];
    }
    if (Object.keys(update).length === 0) return false;
    const response = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": JSON_TYPE },
      body: JSON.stringify(update),
    });
    if (!response.ok) return false;
    await loadSettings();
    return settingProblems().length === 0;
  }

  async function settingsNotice(only) {
    try {
      return (await applySettings(config.key, only)) ? TEXT.fixed : TEXT.fixFailed;
    } catch (_error) {
      return TEXT.fixFailed;
    }
  }

  async function relayJson(method, url, body, headers) {
    const response = await api.relay(
      method,
      url,
      Object.assign({ "Content-Type": JSON_TYPE, Accept: JSON_TYPE }, headers || {}),
      body === undefined ? "" : JSON.stringify(body),
    );
    return { status: Number(response.status), json: parseBody(response) };
  }

  async function authenticates(server, key) {
    const response = await api.relay("GET", `${server}/users/auth`, { "x-auth-user": key, Accept: KOREADER_ACCEPT }, "");
    return Number(response.status);
  }

  function deviceName() {
    return status.device ? `Xteink ${status.device}` : "Xteink";
  }

  async function finishConnecting(server, key) {
    config = {
      server: isSeekquel(server) ? SERVER : server,
      key,
      send_on_sleep: true,
    };
    try {
      await writeJson(DEVICE_FILE, eventsManifest(true));
      await writeJson(CONFIG_FILE, config);
    } catch (_error) {
      showDisconnected(TEXT.saveFailed);
      return;
    }
    try {
      if (!otherSyncServer()) await applySettings(key);
    } catch (_error) {
      showConnected(`${TEXT.fixFailed} ${TEXT.leaveTransfer}`);
      return;
    }
    showConnected(TEXT.leaveTransfer);
  }

  function stopPairing() {
    if (pairing && pairing.timer) clearTimeout(pairing.timer);
    pairing = null;
  }

  async function startPairing() {
    stopPairing();
    show(message(TEXT.starting));
    let started;
    try {
      started = await relayJson("POST", `${SERVER}/pair/start`, {
        device_name: deviceName(),
        platform: status.device || null,
        client: CLIENT,
      });
    } catch (_error) {
      showDisconnected(TEXT.unreachable);
      return;
    }
    if (started.status !== HTTP_CREATED || !started.json || !started.json.device_code) {
      showDisconnected(TEXT.unexpected);
      return;
    }
    const seconds = Number(started.json.interval) || DEFAULT_POLL_SECONDS;
    pairing = {
      deviceCode: started.json.device_code,
      interval: seconds,
      expiresAt: Date.now() + (Number(started.json.expires_in) || 0) * MILLISECONDS_PER_SECOND,
      timer: null,
    };
    showCode(started.json.user_code, started.json.verification_uri_complete);
    schedulePoll();
  }

  function schedulePoll() {
    if (!pairing) return;
    pairing.timer = setTimeout(pollPairing, pairing.interval * MILLISECONDS_PER_SECOND);
  }

  async function pollPairing() {
    const current = pairing;
    if (!current) return;
    if (Date.now() > current.expiresAt) {
      stopPairing();
      showDisconnected(TEXT.expired);
      return;
    }
    let polled;
    try {
      polled = await relayJson("POST", `${SERVER}/pair/poll`, { device_code: current.deviceCode });
    } catch (_error) {
      if (pairing === current) schedulePoll();
      return;
    }
    if (pairing !== current) return;
    if (polled.status === HTTP_OK && polled.json && polled.json.key) {
      stopPairing();
      await finishConnecting(polled.json.sync_url || SERVER, polled.json.key);
      return;
    }
    const type = polled.json && polled.json.error ? polled.json.error.type : null;
    if (type === "slow_down") current.interval += SLOW_DOWN_SECONDS;
    if (PAIRING_STOPPED[type]) {
      stopPairing();
      showDisconnected(PAIRING_STOPPED[type] === "denied" ? TEXT.denied : TEXT.expired);
      return;
    }
    schedulePoll();
  }

  async function adoptExisting() {
    const key = settings[SETTING.username];
    show(message(TEXT.checking));
    let answer;
    try {
      answer = await authenticates(SERVER, key);
    } catch (_error) {
      showDisconnected(TEXT.unreachable);
      return;
    }
    if (answer !== HTTP_OK) {
      showDisconnected(answer === HTTP_UNAUTHORIZED ? TEXT.keyRevoked : TEXT.unexpected);
      return;
    }
    await finishConnecting(SERVER, key);
  }

  async function checkConnection(output, quiet) {
    if (!quiet) output.textContent = TEXT.checking;
    try {
      const answer = await authenticates(config.server, config.key);
      if (answer === HTTP_OK) {
        if (!quiet) output.textContent = TEXT.checkOk;
        return;
      }
      output.textContent = answer === HTTP_UNAUTHORIZED ? TEXT.keyRevoked : TEXT.unexpected;
    } catch (_error) {
      if (!quiet) output.textContent = TEXT.unreachable;
    }
  }

  async function setSendOnSleep(enabled, output) {
    try {
      await writeJson(DEVICE_FILE, eventsManifest(enabled));
      config = Object.assign({}, config, { send_on_sleep: enabled });
      await writeJson(CONFIG_FILE, config);
      showConnected(TEXT.leaveTransfer);
    } catch (_error) {
      output.textContent = TEXT.saveFailed;
    }
  }

  async function disconnect() {
    try {
      await writeJson(DEVICE_FILE, idleManifest());
      await writeJson(CONFIG_FILE, {});
    } catch (_error) {
      showConnected(TEXT.saveFailed);
      return;
    }
    config = {};
    showDisconnected(TEXT.disconnected);
  }

  function showCode(userCode, link) {
    const code = element("p", userCode);
    code.className = "seekquel-code";
    const open = element("a", TEXT.approve);
    open.href = link;
    open.target = "_blank";
    open.rel = "noopener";
    open.className = PRIMARY;
    show(
      element("h3", TEXT.codeHeading),
      code,
      element("p", TEXT.codeBody),
      message(TEXT.waiting),
      actions(
        open,
        button(TEXT.cancel, () => {
          stopPairing();
          showDisconnected();
        }),
      ),
    );
  }

  function showDisconnected(notice) {
    const nodes = [element("p", TEXT.intro)];
    if (notice) nodes.push(message(notice));
    if (status.mode === HOTSPOT_MODE) {
      nodes.push(message(TEXT.hotspot));
      show(...nodes);
      return;
    }
    if (has(SETTING.username) && isSeekquel(settings[SETTING.url]) && settings[SETTING.username]) {
      nodes.push(element("p", TEXT.adoptBody), actions(button(TEXT.adopt, adoptExisting, PRIMARY), button(TEXT.connect, startPairing)));
    } else {
      nodes.push(actions(button(TEXT.connect, startPairing, PRIMARY)));
    }
    show(...nodes);
  }

  function showConnected(notice) {
    const output = message(notice || "");
    const nodes = [element("h3", TEXT.connected)];
    nodes.push(element("p", config.send_on_sleep === false ? TEXT.sendsOnWifi : TEXT.sendsOnSleep));

    const elsewhere = otherSyncServer();
    if (elsewhere) {
      nodes.push(
        element("p", TEXT.elsewhere.replaceAll("{server}", elsewhere)),
        actions(button(TEXT.syncHere, async () => showConnected(await settingsNotice(null)))),
      );
    }

    const problems = settingProblems();
    if (problems.length > 0) {
      const list = element("ul");
      for (const problem of problems) list.appendChild(element("li", PROBLEMS[problem]));
      nodes.push(
        element("h3", TEXT.fixHeading),
        list,
        actions(
          button(TEXT.fix, async () => showConnected(await settingsNotice(elsewhere ? problems : null)), PRIMARY),
        ),
      );
    }

    const toggle = element("label");
    toggle.className = "setting-row";
    const checkbox = element("input");
    checkbox.type = "checkbox";
    checkbox.name = "send_on_sleep";
    checkbox.checked = config.send_on_sleep !== false;
    checkbox.addEventListener("change", () => setSendOnSleep(checkbox.checked, output));
    const name = element("span", TEXT.sleepToggle);
    name.className = "setting-name";
    const control = element("span");
    control.className = "setting-control";
    control.appendChild(checkbox);
    toggle.appendChild(name);
    toggle.appendChild(control);

    nodes.push(
      toggle,
      actions(button(TEXT.check, () => checkConnection(output)), button(TEXT.disconnect, disconnect, DANGER)),
      output,
    );
    show(...nodes);
    return output;
  }

  async function start() {
    show(message(TEXT.checking));
    try {
      const manifest = await readJson(api.pluginFile(MANIFEST_FILE));
      version = manifest && VERSION_PATTERN.test(String(manifest.version)) ? manifest.version : null;
      config = (await readJson(api.pluginFile(CONFIG_FILE))) || {};
      status = (await readJson("/api/status")) || {};
      await loadSettings();
    } catch (_error) {
      version = null;
    }
    if (version === null) {
      show(message(TEXT.loadFailed));
      return;
    }
    if (typeof config.key === "string" && config.key !== "") {
      await checkConnection(showConnected(), true);
      return;
    }
    showDisconnected();
  }

  start();
});
