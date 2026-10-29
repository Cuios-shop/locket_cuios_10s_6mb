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
  if (!options.requestOnly) {
    context.$response = {
      status: options.status === undefined ? 200 : options.status,
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
  assert.equal(JSON.parse(actual.camera).max_duration, 30);
  assert.equal(JSON.parse(actual.camera).quality_mbps, 4);
  assert.equal(JSON.parse(actual.camera).ultra_wide, false);
  assert.deepEqual(JSON.parse(actual.camera_roll).custom, { retained: true });
  assert.equal(JSON.parse(actual.feature_gates).new_feature, "enabled");
  assert.equal(JSON.parse(actual.feature_gates).longer_video, "enabled");
  assert.equal(actual.video_max_duration, "30.0");
  for (const key of ["untouched", "overlay_items", "storage_bucket"]) assert.equal(actual[key], entries[key]);
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
    assert.equal(rule.url, "https://raw.githubusercontent.com/Cuongqtx11/locket30s-fixed/main/scripts/locket.js");
    assert.ok(fs.existsSync(path.join(root, "scripts/locket.js")));
  }
  assert.ok(!moduleText.includes("cloudfunctions"));
  assert.ok(!moduleText.includes("duyvinh09"));
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
