/* global $request, $response, $done, $argument */
// Standalone Surge/Shadowrocket script. No network calls or persistent user data.
(function () {
  "use strict";

  var TAG = "[locket30s-fixed] ";
  var VERSION = "2.1.0";
  var VIDEO_SECONDS = 60;
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
        return false;
      }
      if (!record(previous)) {
        log("firebase: skipped unexpected nested entry " + key);
        return false;
      }
    }
    // Remote Config entry values are strings, including nested JSON.
    entries[key] = JSON.stringify(Object.assign({}, previous, patch));
    return true;
  }

  function configDiagnostics(entries) {
    function shape(value) {
      if (value === undefined) return "absent";
      if (typeof value === "string") {
        try { value = JSON.parse(value); } catch (_) { return "unparsed-string"; }
      }
      if (Array.isArray(value)) return "array(" + value.length + ")";
      if (record(value)) return "object";
      return value === null ? "null" : typeof value;
    }
    function flag(value) {
      if (value === undefined) return "absent";
      if (value === true || value === "true") return "on";
      if (value === false || value === "false") return "off";
      return "other";
    }
    // Fixed allowlists and classifications only. Never print user-controlled values.
    log("diag v" + VERSION + " input schema " + ["camera", "camera_roll", "video_config",
      "feature_gates", "overlay_items", "overlay_dynamic_captions", "widget_frame_event"].map(function (key) {
      return key + "=" + shape(entries[key]);
    }).join(" "));
    log("diag v" + VERSION + " input flags " + ["video_sound_enabled", "microphone_enabled",
      "camera_microphone_enabled", "mh_mic_enabled_v16", "camera_roll_video_enabled",
      "camera_roll_video_upload_enabled", "internal_camera_roll_video_upload_enabled",
      "custom_widget_frames_enabled"].map(function (key) {
      return key + "=" + flag(entries[key]);
    }).join(" "));
  }

  function patchMedia(entries, key, defaults) {
    if (defaults) mergeEntry(entries, key, defaults);
    if (entries[key] === undefined) return;
    var config;
    try {
      config = typeof entries[key] === "string" ? JSON.parse(entries[key]) : entries[key];
    } catch (_) { return; }
    if (!record(config)) return;

    // Compatibility defaults; these do not add native capture/picker implementations.
    var switches = key === "camera" ? ["microphone_enabled", "sound_enabled"]
      : key === "camera_roll" ? ["enabled", "video_enabled", "video_upload_enabled", "preserve_audio"] : [];
    switches.forEach(function (name) {
      if (config[name] === undefined) config[name] = true;
    });

    // Only known media entries; never rewrite arbitrary numbers or Android schemas.
    ["gold_max_duration", "goldMaxDuration", "max_duration", "maxDuration",
      "video_max_duration", "videoMaxDuration", "video_duration", "videoDuration",
      "trim_max_duration", "trimMaxDuration", "camera_roll_max_duration",
      "camera_roll_video_max_duration", "recording_duration", "recording_max_duration",
      "longer_videos_duration", "longer_video_duration", "maximum_duration", "maximumDuration", "max_length"].forEach(function (name) {
      if (Object.prototype.hasOwnProperty.call(config, name)) config[name] = VIDEO_SECONDS;
    });
    // Milliseconds are changed only for explicitly named fields already in the response.
    ["max_duration_ms", "video_max_duration_ms", "gold_max_duration_ms",
      "recording_duration_ms", "trim_max_duration_ms"].forEach(function (name) {
      if (Object.prototype.hasOwnProperty.call(config, name)) config[name] = VIDEO_SECONDS * 1000;
    });
    function audioFlags(object) {
      ["audio_enabled", "sound_enabled", "microphone_enabled", "include_audio", "preserve_audio",
        "muted", "mute", "strip_audio", "remove_audio"].forEach(function (name) {
        if (!Object.prototype.hasOwnProperty.call(object, name)) return;
        var enabled = !/^(?:muted|mute|strip_audio|remove_audio)$/.test(name);
        if (typeof object[name] === "boolean") object[name] = enabled;
        else if (object[name] === "true" || object[name] === "false") object[name] = String(enabled);
      });
    }
    ["enabled", "video_enabled", "video_upload_enabled", "camera_roll_enabled", "recording_enabled"].forEach(function (name) {
      if (typeof config[name] === "boolean") config[name] = true;
      else if (config[name] === "true" || config[name] === "false") config[name] = "true";
    });
    audioFlags(config);
    if (record(config.audio)) {
      audioFlags(config.audio);
      if (typeof config.audio.enabled === "boolean") config.audio.enabled = true;
      else if (config.audio.enabled === "true" || config.audio.enabled === "false") config.audio.enabled = "true";
    }
    entries[key] = JSON.stringify(config);
  }

  function arrayEntry(entries, key) {
    if (entries[key] === undefined) return [];
    try {
      var value = typeof entries[key] === "string" ? JSON.parse(entries[key]) : entries[key];
      if (Array.isArray(value)) return value;
    } catch (_) { /* Keep the original entry if its schema is unknown. */ }
    log("firebase: skipped malformed array entry " + key);
    return null;
  }

  function captionPatch(entries) {
    var nativeTypes = ["standard", "link", "review", "poll", "music", "location", "weather",
      "time", "streak", "star_sign", "color_palette", "locket_count"];
    var types = arrayEntry(entries, "overlay_dynamic_captions");
    if (types) {
      nativeTypes.forEach(function (type) {
        if (types.indexOf(type) < 0) types.push(type);
      });
    }
    var groups = arrayEntry(entries, "overlay_items");
    if (!groups) {
      if (types) entries.overlay_dynamic_captions = JSON.stringify(types);
      return 0;
    }
    var ids = Object.create(null);
    groups.forEach(function (group) {
      if (!record(group) || !Array.isArray(group.items)) return;
      group.items.forEach(function (item) {
        if (record(item) && typeof item.overlay_id === "string") ids[item.overlay_id] = true;
      });
    });
    var additions = [];
    function add(item) {
      if (types && item.source === "remote" && item.caption.type === "static_content") {
        var type = item.overlay_id.replace(/^caption:/, "");
        if (types.indexOf(type) < 0) types.push(type);
      }
      if (ids[item.overlay_id]) return;
      ids[item.overlay_id] = true;
      additions.push(item);
    }
    nativeTypes.forEach(function (type) {
      add({ overlay_id: "caption:" + type, source: "local", caption: { type: type } });
    });
    // Original text-only templates: no external assets, scripts or tracking URLs.
    [
      ["hello", "Xin chào ngày mới", "☀️"],
      ["coffee", "Một chút cà phê", "☕"],
      ["study", "Đang học bài", "📚"],
      ["focus", "Giờ tập trung", "🎯"],
      ["work", "Một ngày làm việc", "💼"],
      ["break", "Nghỉ một chút nhé", "🍃"],
      ["food", "Hôm nay ăn gì?", "🍜"],
      ["music", "Bật bài mình thích", "🎵"],
      ["rain", "Ngày mưa thật chậm", "🌧️"],
      ["sunset", "Hẹn với hoàng hôn", "🌇"],
      ["night", "Chúc bạn ngủ ngon", "🌙"],
      ["weekend", "Cuối tuần của mình", "🎈"],
      ["friends", "Có bạn là vui", "🫶"],
      ["miss", "Gửi bạn một chút nhớ", "💌"],
      ["happy", "Niềm vui hôm nay", "✨"],
      ["calm", "Bình yên một chút", "🌿"],
      ["travel", "Đi tìm một nơi mới", "🧳"],
      ["gym", "Thêm một chút cố gắng", "💪"],
      ["birthday", "Một ngày thật đặc biệt", "🎂"],
      ["memory", "Giữ lại khoảnh khắc này", "📸"]
    ].forEach(function (template, index) {
      var palettes = [["#243B55", "#141E30"], ["#6A3093", "#A044FF"], ["#134E5E", "#237A57"]];
      add({
        overlay_id: "caption:cuong_" + template[0],
        source: "remote",
        caption: {
          type: "static_content", text: template[1],
          icon: { type: "emoji", data: template[2] },
          background: { colors: palettes[index % palettes.length] },
          text_color: "#FFFFFF", max_lines: 1
        }
      });
    });
    if (additions.length) {
      var group = groups.filter(function (candidate) {
        return record(candidate) && candidate.section === "Ghi chú mở rộng · 60s" && Array.isArray(candidate.items);
      })[0];
      if (group) group.items = group.items.concat(additions);
      else groups.push({ section: "Ghi chú mở rộng · 60s", items: additions });
    }
    if (types) entries.overlay_dynamic_captions = JSON.stringify(types);
    entries.overlay_items = JSON.stringify(groups);
    return additions.length;
  }

  function widgetPatch(entries) {
    // Opt in using the complete widget variant module, not a second overlapping rule.
    if (typeof $argument === "undefined" || $argument !== "gold-frame") return "off";
    var changed = mergeEntry(entries, "widget_frame_event", {
      uid: "cuong_gold_frame_v1",
      url: "https://raw.githubusercontent.com/Cuongqtx11/locket30s-fixed/main/assets/widget-gold.png?v=" + VERSION,
      placement: "below",
      use_local_time_zone: true,
      start_at: "2024-01-01T00:00:00",
      end_at: "2099-12-31T23:59:59"
    });
    return changed ? "gold-event-experimental" : "skipped-schema";
  }

  function firebasePatch(payload) {
    if (!record(payload.entries)) {
      log("firebase: skipped missing entries (possibly NO_CHANGE)");
      return false;
    }
    var entries = payload.entries;
    configDiagnostics(entries);
    mergeEntry(entries, "feature_gates", {
      camera_roll: "enabled",
      longer_video: "enabled",
      longer_videos: "enabled",
      video_recording: "enabled",
      video_upload: "enabled",
      camera_roll_video: "enabled",
      video: "enabled",
      long_captions: "enabled",
      custom_widget_frames: "enabled",
      profile_badge: "enabled"
    });
    patchMedia(entries, "camera", {
      gold_max_duration: VIDEO_SECONDS,
      goldMaxDuration: VIDEO_SECONDS,
      max_duration: VIDEO_SECONDS,
      maxDuration: VIDEO_SECONDS,
      video_max_duration: VIDEO_SECONDS,
      videoMaxDuration: VIDEO_SECONDS
    });
    patchMedia(entries, "camera_roll", {
      gold_max_duration: VIDEO_SECONDS,
      goldMaxDuration: VIDEO_SECONDS,
      video_max_duration: VIDEO_SECONDS,
      videoMaxDuration: VIDEO_SECONDS,
      max_duration: VIDEO_SECONDS,
      maxDuration: VIDEO_SECONDS,
      trim_max_duration: VIDEO_SECONDS,
      trimMaxDuration: VIDEO_SECONDS,
      camera_roll_max_duration: VIDEO_SECONDS,
      camera_roll_video_max_duration: VIDEO_SECONDS
    });
    // Do not invent a video_config schema when the server does not provide one.
    patchMedia(entries, "video_config");
    Object.assign(entries, {
      camera_roll_preview_enabled: "true",
      camera_roll_enabled: "true",
      camera_roll_video_enabled: "true",
      camera_roll_video_upload_enabled: "true",
      internal_camera_roll_video_upload_enabled: "true",
      longer_camera_roll_videos_enabled: "true",
      longer_video_enabled: "true",
      longer_videos_enabled: "true",
      video_sound_enabled: "true",
      microphone_enabled: "true",
      camera_microphone_enabled: "true",
      // Community-observed compatibility switch, not a verified Locket API contract.
      mh_mic_enabled_v16: "true",
      custom_widget_frames_enabled: "true",
      captions_enabled: "true",
      overlay_navigator_enabled: "true",
      music_caption_enabled: "true",
      music_caption_song_preview_enabled: "true",
      link_caption_link_enabled: "true",
      profile_badge_visible: "true"
    });
    ["camera_roll_video_max_duration", "camera_roll_max_duration", "camera_roll_duration",
      "max_video_duration", "video_max_duration", "video_trim_max_duration", "trim_max_duration",
      "gold_max_duration", "goldMaxDuration", "longer_video_duration", "longer_videos_duration",
      "longer_video_max_duration", "longer_videos_max_duration", "video_duration",
      "video_record_max_duration", "video_record_duration", "max_recorded_duration",
      "recording_max_duration", "recording_duration", "max_video_record_duration",
      "max_video_duration_seconds", "video_upload_max_duration", "gold_max_video_length_seconds",
      "gold_video_length_limit", "longerVideoDuration", "video_maximum_duration",
      "camera_video_maximum_duration", "video_recording_maximum_duration"].forEach(function (key) {
      entries[key] = VIDEO_SECONDS.toFixed(1);
    });
    ["video", "longer_video", "longerVideo", "can_record_video", "enable_video_recording",
      "can_upload_video", "longerVideosEnabled"].forEach(function (key) {
      if (entries[key] !== undefined && /^(?:true|false)$/.test(String(entries[key]))) entries[key] = "true";
    });
    mergeEntry(entries, "overlays_v2_config", { suggestions_enabled: true });
    var added = captionPatch(entries);
    var widget = widgetPatch(entries);
    if (payload.state === "NO_CHANGE") payload.state = "UPDATE";
    log("firebase: v" + VERSION + " config target=" + VIDEO_SECONDS + "s; captions added=" + added + "; widget=" + widget);
    return true;
  }

  function rewrittenResponse(payload, response) {
    var result = { body: JSON.stringify(payload) };
    if (record(response.headers)) {
      var headers = Object.assign({}, response.headers);
      Object.keys(headers).forEach(function (key) {
        if (/^(?:etag|last-modified|content-length|cache-control)$/i.test(key)) delete headers[key];
      });
      headers["Cache-Control"] = "no-store";
      result.headers = headers;
    }
    return result;
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
    return rewrittenResponse(payload, $response);
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
