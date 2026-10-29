"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "scripts/locket.js"), "utf8");
const moduleText = fs.readFileSync(path.join(root, "locket30s.sgmodule"), "utf8");
const rc = "https://api.revenuecat.com/v1/subscribers/test-user";
const firebase = "https://firebaseremoteconfig.googleapis.com/v1/projects/locket-4252a/namespaces/firebase:fetch";

function run(options = {}) {
  let calls = 0;
  let output;
  const logs = [];
  const context = {
    $request: {
      url: options.url || rc,
      headers: options.headers || { "User-Agent": "Locket/2.0" }
    },
    $done(value) { calls++; output = JSON.parse(JSON.stringify(value)); },
    console: { log(value) { logs.push(value); } }
  };
  if (options.argument !== undefined) context.$argument = options.argument;
  if (!options.requestOnly) {
    context.$response = {
      status: options.status === undefined ? 200 : options.status,
      headers: options.responseHeaders,
      body: options.body === undefined
        ? JSON.stringify(options.payload || { subscriber: { entitlements: {}, subscriptions: {} } })
        : options.body
    };
  }
  vm.runInNewContext(source, context, { timeout: 1000 });
  assert.equal(calls, 1, "$done must be called exactly once");
  return { output, logs, body: output.body ? JSON.parse(output.body) : undefined };
}

test("Gold entitlement and subscription use matching product and expiry", () => {
  const payload = {
    request_date: "2026-10-29T00:00:00Z",
    subscriber: {
      original_app_user_id: "private-test-user",
      entitlements: { Other: { product_identifier: "other" } },
      subscriptions: { other: { expires_date: null } }
    }
  };
  const result = run({ payload });
  const { entitlements, subscriptions } = result.body.subscriber;
  const gold = entitlements.Gold;
  assert.equal(gold.product_identifier, "locket_1600_1y");
  assert.equal(gold.expires_date, subscriptions[gold.product_identifier].expires_date);
  assert.ok(Date.parse(gold.expires_date) > Date.now());
  assert.equal(subscriptions[gold.product_identifier].is_sandbox, false);
  assert.deepEqual(entitlements.Other, payload.subscriber.entitlements.Other);
  assert.deepEqual(subscriptions.other, payload.subscriber.subscriptions.other);
  assert.equal(result.body.request_date, payload.request_date);
  assert.equal(result.body.subscriber.original_app_user_id, "private-test-user");
  assert.ok(result.logs.every(line => !line.includes("private-test-user")));
});

test("active existing Gold and lifetime Gold pass through untouched", () => {
  for (const expiry of ["2098-01-01T00:00:00Z", null]) {
    const payload = { subscriber: {
      entitlements: { Gold: { product_identifier: "locket_paid", expires_date: expiry } },
      subscriptions: { locket_paid: { expires_date: expiry, store_transaction_id: "existing" } }
    } };
    assert.deepEqual(run({ payload }).output, {});
  }
});

test("expired Locket product is reused, preserving unknown fields", () => {
  const result = run({ payload: { subscriber: {
    entitlements: { Gold: { product_identifier: "locket_monthly", expires_date: "2020-01-01T00:00:00Z", extra: true } },
    subscriptions: { locket_monthly: { extra: "keep" } }
  } } });
  assert.equal(result.body.subscriber.entitlements.Gold.product_identifier, "locket_monthly");
  assert.equal(result.body.subscriber.entitlements.Gold.extra, true);
  assert.equal(result.body.subscriber.subscriptions.locket_monthly.extra, "keep");
});

test("supports case insensitive User-Agent and payload-based Locket detection", () => {
  assert.ok(run({ headers: { "USER-AGENT": "locket/1" } }).body);
  assert.ok(run({ headers: {}, payload: { subscriber: { subscriptions: { locket_1600_1y: {} } } } }).body);
  assert.ok(run({ headers: {}, payload: { subscriber: { entitlements: { Gold: { product_identifier: "locket_monthly" } } } } }).body);
});

test("other RevenueCat apps are untouched", () => {
  assert.deepEqual(run({ headers: { "User-Agent": "OtherApp/1" } }).output, {});
  assert.deepEqual(run({ headers: {} }).output, {});
  assert.deepEqual(run({ headers: {}, payload: { subscriber: { entitlements: { Gold: { product_identifier: "other_gold" } } } } }).output, {});
});

test("receipts, encoded subscriber IDs, trailing slash and queries are supported", () => {
  for (const url of [rc + "?platform=ios", rc + "/?x=1", "https://api.revenuecat.com/v1/receipts", "https://api.revenuecat.com/v1/subscribers/%24RCAnonymousID%3Atest"]) {
    assert.ok(run({ url }).body, url);
  }
});

test("errors, empty bodies and unexpected schemas pass through", () => {
  for (const body of ["", "<html>bad gateway</html>", "{broken", "null", "[]", "{}", '{"error":"denied"}', '{"subscriber":[]}', '{"subscriber":{"subscriptions":[]}}', '{"subscriber":{"entitlements":"bad"}}']) {
    assert.deepEqual(run({ body }).output, {}, body);
  }
  for (const status of [204, 304, 400, 401, 403, 429, 500, "HTTP/1.1 503 Service Unavailable", "bad status"]) {
    const options = status === 204 ? { status, body: "" } : { status };
    assert.deepEqual(run(options).output, {}, String(status));
  }
  assert.ok(run({ status: "HTTP/1.1 200 OK" }).body);
});

test("Firebase patches video settings and preserves unrelated and nested fields", () => {
  const entries = {
    untouched: "keep",
    feature_gates: JSON.stringify({ new_feature: "enabled", longer_video: "disabled" }),
    camera: JSON.stringify({ ultra_wide: false, quality_mbps: 4, max_duration: 5 }),
    camera_roll: JSON.stringify({ custom: { retained: true } }),
    overlay_items: '[{"section":"original","items":[]}]',
    storage_bucket: "gs://original-bucket"
  };
  const result = run({ url: firebase, payload: { entries, state: "UPDATE", templateVersion: "12" } });
  const actual = result.body.entries;
  assert.equal(JSON.parse(actual.camera).max_duration, 60);
  assert.equal(JSON.parse(actual.camera).quality_mbps, 4);
  assert.equal(JSON.parse(actual.camera).ultra_wide, false);
  assert.deepEqual(JSON.parse(actual.camera_roll).custom, { retained: true });
  assert.equal(JSON.parse(actual.feature_gates).new_feature, "enabled");
  assert.equal(JSON.parse(actual.feature_gates).longer_video, "enabled");
  assert.equal(actual.video_max_duration, "60.0");
  for (const key of ["untouched", "storage_bucket"]) assert.equal(actual[key], entries[key]);
  assert.equal(JSON.parse(actual.overlay_items)[0].section, "Cuios • Bản quyền");
  assert.equal(result.body.templateVersion, "12");
  assert.ok(Object.values(actual).every(value => typeof value === "string"));
});

test("malformed nested Firebase entries are preserved", () => {
  const result = run({ url: firebase, payload: { entries: { camera: "{broken", camera_roll: "[]", feature_gates: "null" } } });
  assert.equal(result.body.entries.camera, "{broken");
  assert.equal(result.body.entries.camera_roll, "[]");
  assert.equal(result.body.entries.feature_gates, "null");
});

test("Firebase NO_CHANGE is not replaced by an incomplete synthetic config", () => {
  assert.deepEqual(run({ url: firebase, payload: { state: "NO_CHANGE" } }).output, {});
  assert.deepEqual(run({ url: firebase, payload: { entries: [] } }).output, {});
  const result = run({ url: firebase, payload: { entries: { untouched: "yes" }, state: "NO_CHANGE" } });
  assert.equal(result.body.state, "UPDATE");
});

test("cache headers are removed without losing Authorization or signature headers", () => {
  const headers = { "User-Agent": "Locket/1", Authorization: "Bearer fixture", "X-RevenueCat-ETag": "cache", "IF-NONE-MATCH": "cache", "If-Modified-Since": "yesterday", "X-Nonce": "keep" };
  const result = run({ requestOnly: true, headers });
  assert.deepEqual(result.output.headers, { "User-Agent": "Locket/1", Authorization: "Bearer fixture", "X-Nonce": "keep" });
  assert.equal(headers["X-RevenueCat-ETag"], "cache");
  assert.ok(!result.logs.join(" ").includes("Bearer"));
  assert.deepEqual(run({ requestOnly: true }).output, {});
  assert.deepEqual(run({ requestOnly: true, headers: { "User-Agent": "OtherApp", "If-None-Match": "keep" } }).output, {});
  assert.equal(run({ requestOnly: true, url: firebase, headers: { "If-None-Match": "cache", Authorization: "fixture" } }).output.headers.Authorization, "fixture");
});

test("unrelated APIs, other Firebase projects and nested subscriber routes are untouched", () => {
  for (const url of ["https://api.locketcamera.com/changeProfileInfo", "https://firebasestorage.googleapis.com/upload", rc + "/offerings", "https://api.revenuecat.com.evil.test/v1/receipts", firebase.replace("locket-4252a", "other-project"), "https://api.revenuecat.com/v2/subscribers/test-user"]) {
    assert.deepEqual(run({ url }).output, {}, url);
  }
});

const rules = moduleText.split("\n").filter(line => line.includes(" = type=")).map(line => ({
  name: line.split(" = ")[0],
  type: line.match(/type=([^,]+)/)[1],
  pattern: new RegExp(line.match(/pattern=(.*?), script-path=/)[1]),
  url: line.match(/script-path=([^,]+)/)[1]
}));

test("all module rules load an existing script in this repository", () => {
  assert.equal(rules.length, 3);
  for (const rule of rules) {
    assert.equal(rule.url, "https://raw.githubusercontent.com/Cuongqtx11/locket60s_amthanh_mic/main/scripts/locket.js?v=3.0.0");
    assert.ok(fs.existsSync(path.join(root, "scripts/locket.js")));
  }
  assert.ok(!moduleText.includes("cloudfunctions"));
  assert.ok(!moduleText.includes("duyvinh09"));
});

test("60-second settings cover recording, library selection and trimming consistently", () => {
  const result = run({ url: firebase, payload: { entries: {
    camera: JSON.stringify({ video_duration: 15, recording_duration: 15 }),
    camera_roll: JSON.stringify({ trim_max_duration: 15, camera_roll_video_max_duration: 15, maximum_duration: 15, maximumDuration: 15, enabled: false }),
    max_video_record_duration: "15", video_upload_max_duration: "15", longerVideoDuration: "15",
    can_record_video: "false", can_upload_video: "false"
  } } });
  const entries = result.body.entries;
  for (const key of ["camera", "camera_roll"]) {
    const config = JSON.parse(entries[key]);
    for (const [field, value] of Object.entries(config)) {
      if (/duration|Duration/.test(field)) assert.equal(value, 60, key + "." + field);
    }
  }
  for (const [key, value] of Object.entries(entries)) {
    if (/duration/i.test(key)) assert.equal(value, "60.0", key);
  }
  for (const key of ["camera_roll_preview_enabled", "camera_roll_video_enabled", "camera_roll_video_upload_enabled", "internal_camera_roll_video_upload_enabled", "longer_camera_roll_videos_enabled"]) {
    assert.equal(entries[key], "true", key);
  }
  const gates = JSON.parse(entries.feature_gates);
  for (const key of ["longer_video", "longer_videos", "video_recording", "video_upload", "camera_roll_video"]) assert.equal(gates[key], "enabled");
  assert.equal(JSON.parse(entries.camera_roll).enabled, true);
  assert.equal(entries.can_record_video, "true");
  assert.equal(entries.can_upload_video, "true");
});

test("existing video schema keeps codecs, units and unknown fields", () => {
  const original = {
    video_config: JSON.stringify({ max_duration: 15, recording_duration: 15, max_duration_ms: 15000,
      video_codec: "h264", max_upload_bytes: 15000, fps: 15, unknown: { duration: 15 } }),
    android_camera_video_recording: '{"gold":{"maximum_duration":15000}}'
  };
  const entries = run({ url: firebase, payload: { entries: original } }).body.entries;
  const config = JSON.parse(entries.video_config);
  assert.equal(config.max_duration, 60);
  assert.equal(config.recording_duration, 60);
  assert.equal(config.max_duration_ms, 60000);
  assert.equal(config.video_codec, "h264");
  assert.equal(config.max_upload_bytes, 104857600);
  assert.equal(config.fps, 15);
  assert.deepEqual(config.unknown, { duration: 15 });
  assert.equal(entries.android_camera_video_recording, original.android_camera_video_recording);
  assert.equal(run({ url: firebase, payload: { entries: {} } }).body.entries.video_config, undefined);
});

test("sound and mic flags are enabled, while existing mute/strip flags are disabled", () => {
  const result = run({ url: firebase, payload: { entries: {
    camera: JSON.stringify({ microphone_enabled: false, muted: true, audio: { enabled: false, codec: "aac", remove_audio: true } }),
    camera_roll: JSON.stringify({ preserve_audio: false, strip_audio: "true", sound_enabled: "false", codec: "aac" }),
    video_config: JSON.stringify({ include_audio: false, mute: true })
  } } });
  const entries = result.body.entries;
  for (const key of ["video_sound_enabled", "microphone_enabled", "camera_microphone_enabled"]) assert.equal(entries[key], "true");
  const camera = JSON.parse(entries.camera);
  assert.equal(camera.microphone_enabled, true);
  assert.equal(camera.muted, false);
  assert.deepEqual(camera.audio, { enabled: true, codec: "aac", remove_audio: false });
  const roll = JSON.parse(entries.camera_roll);
  assert.equal(roll.preserve_audio, true);
  assert.equal(roll.strip_audio, "false");
  assert.equal(roll.sound_enabled, "true");
  assert.equal(roll.codec, "aac");
  assert.equal(JSON.parse(entries.video_config).include_audio, true);
  assert.equal(JSON.parse(entries.video_config).mute, false);
});

test("54 replacement captions have exact branded ordering, unique IDs and matching registration", () => {
  const result = run({ url: firebase, payload: { entries: {
    overlay_items: '[{"section":"old","items":[{"overlay_id":"caption:cuong_hello"}]}]',
    overlay_dynamic_captions: '["old","music"]',
    overlays_v2_config: '{"unknown":{"keep":true}}'
  } } });
  const groups = JSON.parse(result.body.entries.overlay_items);
  const items = groups.flatMap(group => group.items);
  assert.equal(groups.length, 6);
  assert.equal(items.length, 54);
  assert.deepEqual(groups[0].items.map(item => item.caption.text), ["mua chứng chỉ Cuios.shop", "Bản quyền Cuios", "Cưn🍤", "tom11th5"]);
  assert.ok(groups.slice(1).every(group => group.items.length === 10));
  assert.equal(new Set(items.map(item => item.overlay_id)).size, 54);
  assert.ok(items.every(item => !item.overlay_id.startsWith("caption:cuong_")));
  const types = JSON.parse(result.body.entries.overlay_dynamic_captions);
  assert.deepEqual(types, items.map(item => item.overlay_id.slice("caption:".length)));
  assert.deepEqual(JSON.parse(result.body.entries.overlays_v2_config).unknown, { keep: true });
  assert.deepEqual(run({ url: firebase, payload: result.body }).body, result.body);
});

test("diagnostics expose only fixed schema/flag classifications, never response values", () => {
  const entries = {
    camera: '{"private":"never-print-body"}',
    camera_roll: '{"audio_enabled":false}',
    overlay_items: '[{"section":"private-group-name","items":[]}]',
    video_sound_enabled: "false", microphone_enabled: "true",
    mh_mic_enabled_v16: "private-flag-value",
    private_key_name: "private-entry-value"
  };
  const result = run({ url: firebase, payload: { entries } });
  const logs = result.logs.join("\n");
  assert.ok(logs.includes("diag v3.0.0 input schema camera=object camera_roll=object"));
  assert.ok(logs.includes("overlay_items=array(1)"));
  assert.ok(logs.includes("video_sound_enabled=off microphone_enabled=on"));
  assert.ok(logs.includes("mh_mic_enabled_v16=other"));
  for (const secret of ["never-print-body", "private-group-name", "private-flag-value", "private_key_name", "private-entry-value"]) assert.ok(!logs.includes(secret));
});

test("missing media compatibility flags are added without changing 60s or existing types", () => {
  const entries = run({ url: firebase, payload: { entries: {
    camera: '{"microphone_enabled":"false"}',
    camera_roll: '{"enabled":"false"}'
  } } }).body.entries;
  assert.equal(JSON.parse(entries.camera).microphone_enabled, "true");
  assert.equal(JSON.parse(entries.camera).sound_enabled, true);
  assert.equal(JSON.parse(entries.camera).max_duration, 60);
  assert.equal(JSON.parse(entries.camera_roll).enabled, "true");
  assert.equal(JSON.parse(entries.camera_roll).video_upload_enabled, true);
  assert.equal(entries.mh_mic_enabled_v16, "true");
});

test("widget event is opt in, preserves unknown metadata and keeps asset in this repo", () => {
  const event = '{"uid":"original","url":"https://example.test/original.png","extra":{"keep":true}}';
  const payload = { entries: { widget_frame_event: event } };
  assert.equal(run({ url: firebase, payload }).body.entries.widget_frame_event, event);
  const result = run({ url: firebase, payload, argument: "gold-frame" });
  const patched = JSON.parse(result.body.entries.widget_frame_event);
  assert.equal(patched.uid, "cuios_gold_frame_v3");
  assert.deepEqual(patched.extra, { keep: true });
  assert.equal(patched.url, "https://raw.githubusercontent.com/Cuongqtx11/locket60s_amthanh_mic/main/assets/widget-gold.png?v=3.0.0");
  assert.equal(result.body.entries.video_max_duration, "60.0");
  assert.ok(result.logs.some(line => line.includes("widget=gold-event-experimental")));
  const asset = fs.readFileSync(path.join(root, "assets/widget-gold.png"));
  assert.equal(asset.subarray(1, 4).toString(), "PNG");
  assert.equal(asset.readUInt32BE(16), 1024);
  assert.equal(asset.readUInt32BE(20), 1024);
  assert.equal(asset[25], 6, "RGBA asset required");
  const bad = run({ url: firebase, payload: { entries: { widget_frame_event: "{broken" } }, argument: "gold-frame" });
  assert.equal(bad.body.entries.widget_frame_event, "{broken");
  assert.ok(bad.logs.some(line => line.includes("widget=skipped-schema")));
});

test("widget variant is a complete module with a single explicit Firebase argument", () => {
  const widget = fs.readFileSync(path.join(root, "locket60s-widget.sgmodule"), "utf8");
  const lines = widget.split("\n").filter(line => line.includes(" = type="));
  assert.equal(lines.length, 3);
  assert.equal(lines.filter(line => line.includes("argument=aura-frame")).length, 1);
  assert.ok(lines.find(line => line.startsWith("cuios_config =")).includes("argument=aura-frame"));
});

test("explicit catalogue replacement also repairs malformed old caption lists", () => {
  for (const bad of ["{broken", "{}", "null"]) {
    const entries = run({ url: firebase, payload: { entries: { overlay_items: bad, overlay_dynamic_captions: bad } } }).body.entries;
    assert.equal(JSON.parse(entries.overlay_items).flatMap(group => group.items).length, 54);
    assert.equal(JSON.parse(entries.overlay_dynamic_captions).length, 54);
    assert.equal(entries.video_max_duration, "60.0");
  }
});

test("rewritten response avoids stale HTTP caches without dropping unrelated headers", () => {
  const headers = { "Content-Type": "application/json", ETag: "old", "cache-control": "max-age=86400", "Last-Modified": "old", "Content-Length": "10", "X-Signature": "keep", "X-Other": "keep" };
  const result = run({ responseHeaders: headers });
  assert.deepEqual(result.output.headers, { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Signature": "keep", "X-Other": "keep" });
  assert.equal(headers.ETag, "old");
  assert.deepEqual(run({ status: 500, responseHeaders: headers }).output, {});
});

test("new module and legacy install URL use the same versioned configuration", () => {
  const newModule = fs.readFileSync(path.join(root, "locket60s.sgmodule"), "utf8");
  assert.equal(newModule.replace("/main/locket60s.sgmodule", "/main/locket30s.sgmodule"), moduleText);
  assert.equal(require("../package.json").version, "3.0.0");
  assert.ok(newModule.includes("?v=3.0.0"));
});

test("module URL rules route to the correct handler and exclude unrelated endpoints", () => {
  for (const url of [rc, rc + "?x=1", rc + "/", "https://api.revenuecat.com/v1/receipts", firebase, firebase + "?key=fixture"]) {
    for (const type of ["http-request", "http-response"]) {
      assert.equal(rules.filter(rule => rule.type === type && rule.pattern.test(url)).length, 1, type + " " + url);
    }
    assert.ok(run({ url, payload: url.startsWith("https://firebaseremoteconfig") ? { entries: {} } : { subscriber: {} } }).body);
  }
  for (const url of [rc + "/offerings", firebase.replace("locket-4252a", "other"), "https://api.locketcamera.com/fetchUserV2"]) {
    assert.equal(rules.filter(rule => rule.pattern.test(url)).length, 0, url);
  }
});

test("a library config capped at 10s and 6 MiB becomes 60s and 100 MiB across media profiles", () => {
  const input = { entries: {
    camera_roll: JSON.stringify({
      max_duration: 10, max_file_size: 6291456, fps: 30,
      gold: { max_duration: 10, max_size_bytes: "6291456", max_size_mb: 6, audio: { remove_audio: true } },
      free: { max_duration_ms: 10000, max_upload_bytes: 6291456 },
      upload: { limits: { maximum_duration: 10, max_file_size_bytes: 6291456 } },
      custom: { max_duration: 10, max_file_size: 6291456 }
    }),
    max_upload_bytes: "6291456", max_file_size: "6291456", max_file_size_mb: "6",
    image_cache_max_size: "6291456", storage_bucket_video: "gs://keep-video",
    video_upload_config: '{"max_duration":10,"max_upload_bytes":6291456,"codec":"h264"}'
  } };
  const result = run({ url: firebase, payload: input });
  const entries = result.body.entries;
  const roll = JSON.parse(entries.camera_roll);
  assert.equal(roll.max_duration, 60);
  assert.equal(roll.max_file_size, 104857600);
  assert.equal(roll.gold.max_duration, 60);
  assert.equal(roll.gold.max_size_bytes, "104857600");
  assert.equal(roll.gold.max_size_mb, 100);
  assert.equal(roll.gold.audio.remove_audio, false);
  assert.equal(roll.free.max_duration_ms, 60000);
  assert.equal(roll.free.max_upload_bytes, 104857600);
  assert.equal(roll.upload.limits.maximum_duration, 60);
  assert.equal(roll.upload.limits.max_file_size_bytes, 104857600);
  assert.deepEqual(roll.custom, { max_duration: 10, max_file_size: 6291456 });
  assert.equal(roll.fps, 30);
  assert.equal(entries.max_file_size, "104857600");
  assert.equal(entries.max_file_size_mb, "100");
  assert.equal(entries.image_cache_max_size, "6291456");
  assert.equal(entries.storage_bucket_video, "gs://keep-video");
  assert.deepEqual(JSON.parse(entries.video_upload_config), { max_duration: 60, max_upload_bytes: 104857600, codec: "h264" });
  assert.ok(result.logs.some(line => line.includes('"max_file_size":6291456')));
  assert.ok(result.logs.some(line => line.includes("upload-bytes=104857600; captions=54")));
});

test("all caption backgrounds resolve to local PNG assets and include fallback colors", () => {
  const entries = run({ url: firebase, payload: { entries: {} } }).body.entries;
  const items = JSON.parse(entries.overlay_items).flatMap(group => group.items);
  const uniqueAssets = new Set();
  for (const item of items) {
    const background = item.caption.background;
    assert.equal(background.colors.length, 2);
    assert.ok(background.colors.every(color => /^#[0-9A-F]{6}$/.test(color)));
    const url = new URL(background.image.data);
    assert.equal(url.hostname, "raw.githubusercontent.com");
    assert.ok(url.pathname.startsWith("/Cuongqtx11/locket60s_amthanh_mic/main/assets/captions/"));
    const file = url.pathname.split("/main/")[1];
    assert.ok(fs.existsSync(path.join(root, file)), file);
    uniqueAssets.add(file);
  }
  assert.equal(uniqueAssets.size, 11);
  const catalogue = JSON.parse(fs.readFileSync(path.join(root, "content/captions.json"), "utf8"));
  assert.deepEqual(items.map(item => item.caption.text), catalogue.flatMap(group => group.items.map(item => item[1])));
});

test("all complete module variants route to the new repo and opt in to the selected widget", () => {
  const files = fs.readdirSync(root).filter(file => file.endsWith(".sgmodule"));
  assert.equal(files.length, 7);
  for (const file of files) {
    const module = fs.readFileSync(path.join(root, file), "utf8");
    assert.ok(!module.includes("locket30s-fixed"));
    const lines = module.split("\n").filter(line => line.includes(" = type="));
    assert.equal(lines.length, 3);
    for (const line of lines) {
      assert.ok(line.includes("/locket60s_amthanh_mic/main/scripts/locket.js?v=3.0.0"));
      new RegExp(line.match(/pattern=(.*?), script-path=/)[1]);
    }
    const option = module.match(/argument=([^,]+)/);
    if (file === "locket60s-no-widget.sgmodule") assert.equal(option, null);
    else assert.ok(option);
    const result = run({ url: firebase, payload: { entries: {} }, argument: option ? option[1] : undefined });
    if (option) {
      const event = JSON.parse(result.body.entries.widget_frame_event);
      const asset = new URL(event.url).pathname.split("/main/")[1];
      assert.ok(fs.existsSync(path.join(root, asset)));
    } else assert.equal(result.body.entries.widget_frame_event, undefined);
  }
});

test("posted moments and profile APIs are never rewritten by the new catalogue or upload limits", () => {
  const payload = { data: { caption: "old posted caption", video: { duration: 10, bytes: 6291456 } } };
  for (const url of ["https://api.locketcamera.com/getLatestMomentV2", "https://firebasestorage.googleapis.com/v0/b/locket-video/o", "https://api.locketcamera.com/postMomentV2"]) {
    assert.deepEqual(run({ url, payload }).output, {});
  }
});
