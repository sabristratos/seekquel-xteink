import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { defaultSettings, mount, PLUGIN_DIR } from "./harness.mjs";

const SERVER = "https://api.seekquel.app/koreader";
const KEY = "ABCD-EFGH-IJKL-MNOP";
const VERSION = JSON.parse(fs.readFileSync(path.join(PLUGIN_DIR, "manifest.json"), "utf8")).version;

const SESSION = {
  book: '/Books/Le "Grand" Meaulnes.epub',
  document: "0123456789abcdef0123456789abcdef",
  start_time: "1757786400",
  end_time: "1757788200",
  duration_seconds: "1800",
  start_progress_bp: "1000",
  end_progress_bp: "1500",
  progress_scale: "10000",
  id: "a1b2c3-7",
};

function render(template, values) {
  return template.replace(/\{(event|cfg)\.([a-z_]+)\}/g, (whole, scope, name) => {
    const value = values[scope][name];
    return value === undefined ? whole : String(value);
  });
}

function pairingRelay({ pollAnswers }) {
  const answers = [...pollAnswers];
  return async (method, url) => {
    if (url === `${SERVER}/pair/start`) {
      return {
        status: 201,
        body: JSON.stringify({
          device_code: "d".repeat(64),
          user_code: "WXYZ-2345",
          verification_uri_complete: "https://seekquel.app/settings/integrations/xteink?pair=WXYZ-2345",
          expires_in: 600,
          interval: 5,
        }),
      };
    }
    if (url === `${SERVER}/pair/poll`) return answers.shift();
    throw new Error(`unexpected relay ${method} ${url}`);
  };
}

const PENDING = { status: 428, body: JSON.stringify({ error: { type: "authorization_pending" } }) };
const APPROVED = { status: 200, body: JSON.stringify({ key: KEY, sync_url: SERVER, device_id: "01J" }) };

test("the shipped manifests name the plugin and carry no events until it is connected", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(PLUGIN_DIR, "manifest.json"), "utf8"));
  const device = JSON.parse(fs.readFileSync(path.join(PLUGIN_DIR, "device.json"), "utf8"));

  assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
  assert.equal(manifest.mount, "settings");
  assert.equal(device.title, manifest.title);
  assert.equal(device.events, undefined);
  assert.ok(Buffer.byteLength(fs.readFileSync(path.join(PLUGIN_DIR, "README.md"))) < 16 * 1024);
});

test("the device is named from the model the firmware reports", async () => {
  const names = {};
  for (const device of ["xteink_x4_pro", "xteink_x3", "X4", ""]) {
    const page = await mount({ status: { device }, relay: pairingRelay({ pollAnswers: [PENDING] }) });
    await page.click("Connect to Seekquel");
    names[device] = page.relays.find((call) => call.url.endsWith("/pair/start")).body.device_name;
  }

  assert.deepEqual(names, { xteink_x4_pro: "Xteink X4 Pro", xteink_x3: "Xteink X3", X4: "Xteink X4", "": "Xteink" });
});

test("connecting pairs by code, writes the events manifest and fixes the reader's sync settings", async () => {
  const page = await mount({ relay: pairingRelay({ pollAnswers: [PENDING, APPROVED] }) });

  await page.click("Connect to Seekquel");

  assert.match(page.text(), /WXYZ-2345/);
  const start = page.relays.find((call) => call.url.endsWith("/pair/start"));
  assert.deepEqual(start.body, { device_name: "Xteink X4", platform: "X4", client: "xteink" });
  const open = page.find((node) => node.tagName === "A");
  assert.equal(open.href, "https://seekquel.app/settings/integrations/xteink?pair=WXYZ-2345");

  await page.runTimers();

  assert.match(page.text(), /Connected to Seekquel/);
  assert.match(page.text(), /leave File Transfer/);
  assert.deepEqual(page.fileJson("config.json").key, KEY);
  assert.equal(page.fileJson("config.json").server, SERVER);
  assert.deepEqual(page.deviceSettings, defaultSettings({
    koServerUrl: SERVER,
    koUsername: KEY,
    koPassword: "seekquel",
    koServerType: 2,
    koMatchMethod: 1,
    koSendMetadata: 1,
    koSyncClippings: 0,
  }));

  const handler = page.fileJson("device.json").events["reader.session"];
  assert.equal(handler.connect, true);
  assert.equal(handler.request.method, "POST");
  assert.equal(render(handler.request.url, { cfg: page.fileJson("config.json"), event: {} }), `${SERVER}/reading-sessions`);
  assert.equal(render(handler.request.headers["x-auth-user"], { cfg: page.fileJson("config.json"), event: {} }), KEY);
});

test("the session template renders to the body the server reads, whatever the file is called", async () => {
  const page = await mount({ relay: pairingRelay({ pollAnswers: [APPROVED] }) });
  await page.click("Connect to Seekquel");
  await page.runTimers();

  const request = page.fileJson("device.json").events["reader.session"].request;
  const body = JSON.parse(render(request.body, { cfg: page.fileJson("config.json"), event: SESSION }));

  assert.deepEqual(body, {
    document: SESSION.document,
    start_time: 1757786400,
    end_time: 1757788200,
    duration_seconds: 1800,
    start_progress_bp: 1000,
    end_progress_bp: 1500,
    progress_scale: 10000,
    event_id: SESSION.id,
    client: "crosspoint-reader",
    plugin_version: VERSION,
  });
  assert.equal(render(request.headers["X-Book-Path"], { cfg: {}, event: SESSION }), SESSION.book);
  assert.ok(!request.body.includes("{event.book}"));
});

test("a reader that already syncs with Seekquel reuses its key instead of pairing again", async () => {
  const page = await mount({
    settings: defaultSettings({ koServerUrl: `${SERVER}/`, koUsername: KEY, koServerType: 1 }),
    relay: async (method, url, headers) => {
      assert.equal(url, `${SERVER}/users/auth`);
      assert.equal(headers["x-auth-user"], KEY);
      return { status: 200, body: "{}" };
    },
  });

  await page.click("Use that account");

  assert.match(page.text(), /Connected to Seekquel/);
  assert.equal(page.fileJson("config.json").key, KEY);
  assert.equal(page.deviceSettings.koMatchMethod, 1);
  assert.equal(page.deviceSettings.koServerType, 2);
  assert.ok(!page.relays.some((call) => call.url.endsWith("/pair/start")));
});

test("a connected reader whose settings drifted is told what is wrong and can fix it", async () => {
  const page = await mount({
    config: { server: SERVER, key: KEY, send_on_sleep: true },
    settings: defaultSettings({ koServerUrl: SERVER, koUsername: KEY, koServerType: 2, koMatchMethod: 0, koSendMetadata: 1 }),
    relay: async () => ({ status: 200, body: "{}" }),
  });

  assert.match(page.text(), /matched by file name/);
  assert.doesNotMatch(page.text(), /not Seekquel's/);

  await page.click("Fix sync settings");

  assert.match(page.text(), /Sync settings updated/);
  assert.doesNotMatch(page.text(), /matched by file name/);
});

test("a reader that syncs its place with another server keeps it, and only the settings Seekquel still needs are offered", async () => {
  const other = "https://sync.crosspointreader.com";
  const page = await mount({
    config: { server: SERVER, key: KEY, send_on_sleep: true },
    settings: defaultSettings({ koServerUrl: other, koUsername: "schwingi", koPassword: "secret", koServerType: 1, koMatchMethod: 0, koSendMetadata: 0, koSyncClippings: 1 }),
    relay: async () => ({ status: 200, body: "{}" }),
  });

  assert.match(page.text(), /syncs with sync\.crosspointreader\.com, not Seekquel/);
  assert.match(page.text(), /matched by file name/);
  assert.doesNotMatch(page.text(), /not Seekquel's|not this reader's Seekquel key|titles are not sent|server type|Clippings sync/);

  await page.click("Fix sync settings");

  assert.deepEqual(page.deviceSettings, defaultSettings({
    koServerUrl: other,
    koUsername: "schwingi",
    koPassword: "secret",
    koServerType: 1,
    koMatchMethod: 1,
    koSendMetadata: 0,
    koSyncClippings: 1,
  }));
  assert.match(page.text(), /Sync settings updated/);
  assert.match(page.text(), /syncs with sync\.crosspointreader\.com/);

  await page.click("Sync my place with Seekquel instead");

  assert.equal(page.deviceSettings.koServerUrl, SERVER);
  assert.equal(page.deviceSettings.koUsername, KEY);
  assert.equal(page.deviceSettings.koSyncClippings, 0);
  assert.doesNotMatch(page.text(), /not Seekquel\./);
});

test("connecting a reader that syncs its place with another server keeps every setting until the reader chooses", async () => {
  const other = "https://sync.crosspointreader.com";
  const page = await mount({
    settings: defaultSettings({ koServerUrl: other, koUsername: "schwingi", koPassword: "secret" }),
    relay: pairingRelay({ pollAnswers: [APPROVED] }),
  });

  await page.click("Connect to Seekquel");
  await page.runTimers();

  assert.equal(page.fileJson("config.json").key, KEY);
  assert.deepEqual(page.deviceSettings, defaultSettings({
    koServerUrl: other,
    koUsername: "schwingi",
    koPassword: "secret",
  }));
  assert.match(page.text(), /syncs with sync\.crosspointreader\.com, not Seekquel/);
  page.button("Fix sync settings");
  assert.match(page.text(), /applies to sync\.crosspointreader\.com too/);
  page.button("Sync my place with Seekquel instead");
});

test("a sync settings change the reader does not take says so rather than nothing", async () => {
  const page = await mount({
    config: { server: SERVER, key: KEY, send_on_sleep: true },
    settings: defaultSettings({ koServerUrl: SERVER, koUsername: KEY, koServerType: 2, koMatchMethod: 0, koSendMetadata: 1 }),
    relay: async () => ({ status: 200, body: "{}" }),
  });
  Object.freeze(page.deviceSettings);

  await page.click("Fix sync settings");

  assert.match(page.text(), /did not take the new settings/);
});

test("turning off sending at sleep rewrites the manifest so the reader stops waking its Wi-Fi", async () => {
  const page = await mount({
    config: { server: SERVER, key: KEY, send_on_sleep: true },
    settings: defaultSettings({ koServerUrl: SERVER, koUsername: KEY, koServerType: 2, koMatchMethod: 1, koSendMetadata: 1 }),
    relay: async () => ({ status: 200, body: "{}" }),
  });
  const checkbox = page.find((node) => node.name === "send_on_sleep");
  checkbox.checked = false;

  await checkbox.listeners.change();
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(page.fileJson("device.json").events["reader.session"].connect, false);
  assert.equal(page.fileJson("config.json").send_on_sleep, false);
  assert.match(page.text(), /next time this reader is on Wi-Fi/);
});

test("a declined code says so and offers to start again", async () => {
  const page = await mount({
    relay: pairingRelay({ pollAnswers: [{ status: 403, body: JSON.stringify({ error: { type: "access_denied" } }) }] }),
  });

  await page.click("Connect to Seekquel");
  await page.runTimers();

  assert.match(page.text(), /declined in Seekquel/);
  page.button("Connect to Seekquel");
  assert.equal(page.files.has("config.json"), false);
});

test("a reader that cannot reach the internet is told so rather than left waiting", async () => {
  const page = await mount({
    relay: async () => {
      throw new Error("/api/relay 502: relay failed");
    },
  });

  await page.click("Connect to Seekquel");

  assert.match(page.text(), /could not reach Seekquel/);
});

test("a reader in hotspot mode is asked to join Wi-Fi before anything else", async () => {
  const page = await mount({ status: { mode: "AP" }, relay: async () => ({ status: 200, body: "{}" }) });

  assert.match(page.text(), /hotspot mode/);
  assert.throws(() => page.button("Connect to Seekquel"));
});

test("disconnecting removes the events and the key from the card", async () => {
  const page = await mount({
    config: { server: SERVER, key: KEY, send_on_sleep: true },
    settings: defaultSettings({ koServerUrl: SERVER, koUsername: KEY, koServerType: 2, koMatchMethod: 1, koSendMetadata: 1 }),
    relay: async () => ({ status: 200, body: "{}" }),
  });

  await page.click("Disconnect");

  assert.equal(page.fileJson("device.json").events, undefined);
  assert.deepEqual(page.fileJson("config.json"), {});
  assert.match(page.text(), /no longer sends reading time/);
});

test("a key the server no longer accepts is reported by Check connection", async () => {
  const page = await mount({
    config: { server: SERVER, key: KEY, send_on_sleep: true },
    settings: defaultSettings({ koServerUrl: SERVER, koUsername: KEY, koServerType: 2, koMatchMethod: 1, koSendMetadata: 1 }),
    relay: async () => ({ status: 401, body: "{}" }),
  });

  await page.click("Check connection");

  assert.match(page.text(), /no longer accepts this reader's key/);
});

test("opening the card for a removed device says so without a tap, and a working one stays quiet", async () => {
  const connected = {
    config: { server: SERVER, key: KEY, send_on_sleep: true },
    settings: defaultSettings({ koServerUrl: SERVER, koUsername: KEY, koServerType: 2, koMatchMethod: 1, koSendMetadata: 1 }),
  };

  const removed = await mount({ ...connected, relay: async () => ({ status: 401, body: "{}" }) });
  assert.match(removed.text(), /no longer accepts this reader's key/);

  const working = await mount({ ...connected, relay: async () => ({ status: 200, body: "{}" }) });
  assert.doesNotMatch(working.text(), /Seekquel answered|no longer accepts/);
});

test("a sync address that is not https is ignored and the reader is paired to Seekquel's own", async () => {
  const insecure = { status: 200, body: JSON.stringify({ key: KEY, sync_url: "http://collector.example/koreader", device_id: "01J" }) };
  const page = await mount({ relay: pairingRelay({ pollAnswers: [insecure] }) });

  await page.click("Connect to Seekquel");
  await page.runTimers();

  assert.equal(page.fileJson("config.json").server, SERVER);
  assert.equal(page.deviceSettings.koServerUrl, SERVER);
});

test("a key that is not a string is not stored", async () => {
  const odd = { status: 200, body: JSON.stringify({ key: { a: 1 }, sync_url: SERVER }) };
  const page = await mount({ relay: pairingRelay({ pollAnswers: [odd] }) });

  await page.click("Connect to Seekquel");
  await page.runNextTimer();

  assert.equal(page.files.has("config.json"), false);
  assert.doesNotMatch(page.text(), /Connected to Seekquel/);
});

test("a failed save while connecting leaves no events behind", async () => {
  let configWrites = 0;
  const page = await mount({
    relay: pairingRelay({ pollAnswers: [APPROVED] }),
    failWrite: (name) => name === "config.json" && (configWrites += 1) === 1,
  });

  await page.click("Connect to Seekquel");
  await page.runTimers();

  assert.match(page.text(), /could not save to its memory card/);
  assert.equal(page.fileJson("device.json").events, undefined);
  assert.deepEqual(page.fileJson("config.json"), {});
});
