/* global $request, $response, $done */
// Standalone Surge/Shadowrocket script. No network calls or persistent user data.
(function () {
  "use strict";

  var TAG = "[locket30s-fixed] ";
  var RC = /^https:\/\/api\.revenuecat\.com\/v1\/(?:receipts|subscribers\/[^/?#]+)\/?(?:\?[^#]*)?$/i;
  var FIREBASE = /^https:\/\/firebaseremoteconfig\.googleapis\.com\/v1\/projects\/locket-4252a\/namespaces\/firebase:fetch(?:\?[^#]*)?$/i;

  function log(message) {
    // Deliberately omit URLs, headers, IDs and response bodies from logs.
    if (typeof console !== "undefined" && typeof console.log === "function") {
      console.log(TAG + message);
    }
  }

  function record(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function header(headers, name) {
    var keys = Object.keys(headers || {});
    for (var i = 0; i < keys.length; i++) {
      if (keys[i].toLowerCase() === name) return String(headers[keys[i]]);
    }
    return "";
  }

  function locketRequest(request) {
    return /locket/i.test(header(request.headers, "user-agent"));
  }

  function locketSubscriber(subscriber) {
    var gold = record(subscriber.entitlements) ? subscriber.entitlements.Gold : null;
    return (record(gold) && typeof gold.product_identifier === "string" &&
      /^locket_/i.test(gold.product_identifier)) ||
      (record(subscriber.subscriptions) && Object.keys(subscriber.subscriptions).some(function (key) {
        return /^locket_/i.test(key);
      }));
  }

  function statusCode(response) {
    var value = response.statusCode !== undefined ? response.statusCode : response.status;
    if (value === undefined) return 200; // Some compatible runtimes omit status.
    var match = String(value).match(/\b([1-5]\d{2})\b/);
    return match ? Number(match[1]) : 0;
  }

  function requestPatch(request, isRC) {
    // RevenueCat is shared by other apps. Only alter identifiable Locket requests.
    if (isRC && !locketRequest(request)) return {};
    var headers = Object.assign({}, request.headers || {});
    var changed = false;
    Object.keys(headers).forEach(function (key) {
      if (/^(?:if-none-match|if-modified-since|x-revenuecat-etag)$/i.test(key)) {
        delete headers[key];
        changed = true;
      }
    });
    if (changed) log("request: removed conditional cache headers");
    return changed ? { headers: headers } : {};
  }

  function goldPatch(payload, request) {
    if (!record(payload.subscriber)) {
      log("revenuecat: skipped unexpected subscriber schema");
      return false;
    }
    var subscriber = payload.subscriber;
    if (!locketRequest(request) && !locketSubscriber(subscriber)) {
      log("revenuecat: skipped unrecognized app");
      return false;
    }
    if ((subscriber.entitlements != null && !record(subscriber.entitlements)) ||
        (subscriber.subscriptions != null && !record(subscriber.subscriptions))) {
      log("revenuecat: skipped unexpected entitlement schema");
      return false;
    }
    var entitlements = subscriber.entitlements || {};
    var subscriptions = subscriber.subscriptions || {};
    var oldGold = record(entitlements.Gold) ? entitlements.Gold : {};
    var currentProduct = oldGold.product_identifier;
    var currentSubscription = subscriptions[currentProduct];
    if (record(currentSubscription) &&
        (oldGold.expires_date === null || Date.parse(oldGold.expires_date) > Date.now()) &&
        (currentSubscription.expires_date === null || Date.parse(currentSubscription.expires_date) > Date.now())) {
      log("revenuecat: existing active Gold preserved");
      return false;
    }
    var product = typeof currentProduct === "string" && /^locket_/i.test(currentProduct)
      ? currentProduct : "locket_1600_1y";
    var previous = record(subscriptions[product]) ? subscriptions[product] : {};
    var purchase = "2024-01-01T00:00:00Z";
    var expiration = "2099-12-31T23:59:59Z";
    subscriber.subscriptions = subscriptions;
    subscriber.entitlements = entitlements;
    subscriptions[product] = Object.assign({}, previous, {
      purchase_date: purchase,
      original_purchase_date: purchase,
      expires_date: expiration,
      store: "app_store",
      ownership_type: "PURCHASED",
      period_type: "normal",
      is_sandbox: false,
      billing_issues_detected_at: null,
      unsubscribe_detected_at: null,
      grace_period_expires_date: null,
      refunded_at: null
    });
    entitlements.Gold = Object.assign({}, oldGold, {
      product_identifier: product,
      purchase_date: purchase,
      expires_date: expiration,
      grace_period_expires_date: null
    });
    log("revenuecat: local Gold response patched");
    return true;
  }

  function mergeEntry(entries, key, patch) {
    var previous = {};
    if (entries[key] !== undefined) {
      try {
        previous = typeof entries[key] === "string" ? JSON.parse(entries[key]) : entries[key];
      } catch (_) {
        log("firebase: skipped malformed nested entry " + key);
        return;
      }
      if (!record(previous)) {
        log("firebase: skipped unexpected nested entry " + key);
        return;
      }
    }
    // Remote Config entry values are strings, including nested JSON.
    entries[key] = JSON.stringify(Object.assign({}, previous, patch));
  }

  function firebasePatch(payload) {
    if (!record(payload.entries)) {
      log("firebase: skipped missing entries (possibly NO_CHANGE)");
      return false;
    }
    var entries = payload.entries;
    mergeEntry(entries, "feature_gates", {
      camera_roll: "enabled",
      longer_video: "enabled",
      video: "enabled",
      long_captions: "enabled",
      profile_badge: "enabled"
    });
    mergeEntry(entries, "camera", {
      gold_max_duration: 30,
      goldMaxDuration: 30,
      max_duration: 30,
      maxDuration: 30
    });
    mergeEntry(entries, "camera_roll", {
      gold_max_duration: 30,
      goldMaxDuration: 30,
      video_max_duration: 30,
      videoMaxDuration: 30,
      max_duration: 30,
      maxDuration: 30,
      trim_max_duration: 30,
      trimMaxDuration: 30
    });
    Object.assign(entries, {
      camera_roll_video_enabled: "true",
      camera_roll_video_upload_enabled: "true",
      longer_camera_roll_videos_enabled: "true",
      camera_roll_video_max_duration: "30.0",
      camera_roll_max_duration: "30.0",
      max_video_duration: "30.0",
      video_max_duration: "30.0",
      video_trim_max_duration: "30.0",
      gold_max_duration: "30.0",
      profile_badge_visible: "true"
    });
    if (payload.state === "NO_CHANGE") payload.state = "UPDATE";
    log("firebase: local Gold/video configuration patched");
    return true;
  }

  function main() {
    if (typeof $request === "undefined") return {};
    var url = String($request.url || "");
    var isRC = RC.test(url);
    if (!isRC && !FIREBASE.test(url)) return {};
    if (typeof $response === "undefined") return requestPatch($request, isRC);
    var status = statusCode($response);
    if (status < 200 || status >= 300) {
      log("response: skipped HTTP " + status);
      return {};
    }
    if (typeof $response.body !== "string" || !$response.body.trim()) {
      log("response: skipped empty or non-text body");
      return {};
    }
    var payload = JSON.parse($response.body);
    if (!record(payload) || Object.prototype.hasOwnProperty.call(payload, "error")) {
      log("response: skipped unexpected payload");
      return {};
    }
    if (!(isRC ? goldPatch(payload, $request) : firebasePatch(payload))) return {};
    return { body: JSON.stringify(payload) };
  }

  var result = {};
  try {
    result = main();
  } catch (_) {
    log("response: skipped invalid JSON or unsupported runtime");
  }
  // A single completion point also covers invalid input and unknown URLs.
  $done(result);
}());
