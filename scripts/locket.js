/* global $request, $response, $done, $argument */
// Standalone Surge/Shadowrocket script. No network calls or persistent user data.
(function () {
  "use strict";

  var TAG = "[locket60s_amthanh_mic] ";
  var VERSION = "3.0.0";
  var VIDEO_SECONDS = 60;
  var VIDEO_BYTES = 100 * 1024 * 1024;
  var ASSET_BASE = "https://raw.githubusercontent.com/Cuongqtx11/locket60s_amthanh_mic/main/assets/";
  // BEGIN GENERATED CAPTION CATALOGUE
  var CAPTIONS = [{"id":"brand","section":"Cuios • Bản quyền","background":"brand","items":[["certificate","mua chứng chỉ Cuios.shop","👑"],["copyright","Bản quyền Cuios","✨"],["cun","Cưn🍤","🍤"],["tom","tom11th5","💛"]]},{"id":"love","section":"Tình yêu","background":"love","items":[["choose","Tim tớ chọn cậu rồi","💗"],["withyou","Đi đâu cũng muốn có cậu","🫶"],["soft","Gặp cậu là ngày đẹp","🌷"],["little","Thương cậu thêm một chút","💕"],["home","Bên cậu là thấy nhà","🏡"],["hug","Gửi cậu một cái ôm","🤍"],["miss","Nhớ cậu, không cần lý do","💌"],["smile","Cậu cười là tớ thua","🥰"],["wait","Chừa một chỗ cạnh tớ nhé","💞"],["simple","Thích cậu, thế thôi","💘"]]},{"id":"joy","section":"Vui vẻ","background":"joy","items":[["enough","Hôm nay vui vừa đủ","🌞"],["vitamin","Nạp một chút vitamin cười","🍊"],["happy","Đang bận yêu đời","🌈"],["broadcast","Niềm vui đang phát sóng","📻"],["sun","Mang nắng về nhà","☀️"],["luck","May mắn ghé chơi rồi","🍀"],["photo","Chụp vội một ngày xinh","📸"],["weekend","Cuối tuần nằm trong tim","🎈"],["save","Một ngày đáng lưu lại","✨"],["laugh","Cười lên, ảnh đang đẹp","😆"]]},{"id":"mood","section":"Cảm xúc","background":"mood","items":[["rain","Hôm nay lòng hơi mưa","🌧️"],["quiet","Cho tớ yên một chút","🌙"],["thought","Có vài điều chưa nói","💭"],["slow","Đang học cách chậm lại","🍃"],["hug","Một cái ôm là đủ","🫂"],["tired","Hết pin, cần được thương","🪫"],["okay","Không ổn cũng không sao","🤍"],["hope","Ngày mai mình thử lại","🌅"],["memory","Có người nằm trong ký ức","🎞️"],["feeling","Chẳng biết gọi tên cảm xúc","🫧"]]},{"id":"tease","section":"Trêu đùa","background":"tease","items":[["cute","Xinh thế này ai chịu nổi","😎"],["seen","Xem rồi thì nhớ tớ đi","👀"],["crush","Đẹp vậy mà vẫn độc thân","😌"],["heart","Lỡ xem là phải thả tim","😏"],["busy","Bận đáng yêu, lát nhắn","💅"],["snack","Không giận, chỉ thiếu trà sữa","🧋"],["signal","Phát tín hiệu: nhớ bạn","📡"],["sleep","Online đó, nhưng buồn ngủ","😴"],["model","Camera thường, người phi thường","🤳"],["notice","Thông báo: cần được cưng","📣"]]},{"id":"gentle","section":"Dịu dàng","background":"gentle","items":[["breathe","Hít thở rồi mình đi tiếp","🌿"],["coffee","Cà phê ấm, lòng nhẹ hơn","☕"],["small","Gom niềm vui nhỏ mỗi ngày","🪴"],["enough","Mình đã cố gắng đủ rồi","🌼"],["kind","Dịu dàng với mình một chút","🕊️"],["now","Ở đây, ngay lúc này","🍵"],["sky","Ngước lên, trời vẫn xanh","☁️"],["rest","Nghỉ một nhịp cũng được","🛋️"],["bloom","Mỗi người một mùa nở hoa","🌸"],["night","Ngủ ngon, mai mình lại xinh","🌙"]]}];
  // END GENERATED CAPTION CATALOGUE
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
    var library;
    try { library = typeof entries.camera_roll === "string" ? JSON.parse(entries.camera_roll) : entries.camera_roll; } catch (_) { library = null; }
    var report = [];
    function inspect(object, path, depth) {
      if (!record(object) || depth > 4 || report.length >= 8) return;
      var limits = { path: path };
      ["max_duration", "video_max_duration", "maximum_duration", "trim_max_duration",
        "max_duration_ms", "max_file_size", "max_upload_bytes", "max_size_bytes", "max_size_mb"].forEach(function (key) {
        if (typeof object[key] === "number" || (typeof object[key] === "string" && /^\d+(?:\.\d+)?$/.test(object[key]))) {
          var number = Number(object[key]);
          if (isFinite(number) && number >= 0 && number <= 1e12) limits[key] = number;
        }
      });
      if (Object.keys(limits).length > 1) report.push(limits);
      ["video", "upload", "recording", "trim", "limits", "free", "gold", "default"].forEach(function (key) {
        inspect(object[key], path + "." + key, depth + 1);
      });
    }
    inspect(library, "camera_roll", 0);
    log("diag v" + VERSION + " input library limits " + JSON.stringify(report));
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
    function limits(object, depth) {
      ["gold_max_duration", "goldMaxDuration", "max_duration", "maxDuration", "video_max_duration", "videoMaxDuration",
        "maximum_duration", "maximumDuration", "trim_max_duration", "trimMaxDuration", "recording_duration",
        "max_length", "video_duration", "video_upload_max_duration", "camera_roll_max_duration", "camera_roll_video_max_duration"].forEach(function (name) {
        if (Object.prototype.hasOwnProperty.call(object, name)) object[name] = VIDEO_SECONDS;
      });
      ["max_duration_ms", "video_max_duration_ms", "gold_max_duration_ms", "recording_duration_ms", "trim_max_duration_ms"].forEach(function (name) {
        if (Object.prototype.hasOwnProperty.call(object, name)) object[name] = VIDEO_SECONDS * 1000;
      });
      ["max_file_size", "max_upload_bytes", "max_size_bytes", "max_file_size_bytes", "video_max_size_bytes", "max_video_size_bytes"].forEach(function (name) {
        if (Object.prototype.hasOwnProperty.call(object, name)) {
          object[name] = typeof object[name] === "string" ? String(VIDEO_BYTES) : VIDEO_BYTES;
        }
      });
      ["max_file_size_mb", "max_size_mb", "max_upload_mb"].forEach(function (name) {
        if (Object.prototype.hasOwnProperty.call(object, name)) object[name] = typeof object[name] === "string" ? "100" : 100;
      });
      audioFlags(object);
      if (record(object.audio)) audioFlags(object.audio);
      if (depth >= 4) return;
      ["video", "upload", "recording", "trim", "limits", "free", "gold", "default"].forEach(function (name) {
        if (record(object[name])) limits(object[name], depth + 1);
      });
    }
    limits(config, 0);
    entries[key] = JSON.stringify(config);
  }

  function captionPatch(entries) {
    // Replace the old picker catalogue as requested; never edit posted moments.
    var types = [];
    var count = 0;
    var colors = {
      brand: ["#3F2B13", "#77541F"], love: ["#59223F", "#342044"],
      joy: ["#6A3620", "#503058"], mood: ["#252B56", "#432B59"],
      tease: ["#4E2668", "#243E67"], gentle: ["#174B45", "#293F54"]
    };
    var groups = CAPTIONS.map(function (group) {
      return {
        section: group.section,
        items: group.items.map(function (template, index) {
          var type = "cuios_" + group.id + "_" + template[0];
          var background = group.background === "brand" ? "brand" : group.background + "_" + (index % 2 + 1);
          types.push(type);
          count++;
          return {
            overlay_id: "caption:" + type,
            source: "remote",
            caption: {
              type: "static_content", text: template[1],
              localized_text: { vi: template[1], en: template[1] },
              icon: { type: "emoji", data: template[2] },
              background: {
                colors: colors[group.background],
                image: { type: "image", source: "url", data: ASSET_BASE + "captions/" + background + ".png?v=" + VERSION }
              },
              text_color: "#FFFFFF", max_lines: 1
            }
          };
        })
      };
    });
    entries.overlay_items = JSON.stringify(groups);
    entries.overlay_dynamic_captions = JSON.stringify(types);
    return count;
  }

  function widgetPatch(entries) {
    var mode = typeof $argument === "string" ? $argument : "";
    var theme = { "aura-frame": "aura", "gold-frame": "gold", "rose-frame": "rose" }[mode];
    if (!theme) return "off";
    var changed = mergeEntry(entries, "widget_frame_event", {
      uid: "cuios_" + theme + "_frame_v3",
      url: ASSET_BASE + "widget-" + theme + ".png?v=" + VERSION,
      placement: "below", use_local_time_zone: true,
      start_at: "2024-01-01T00:00:00", end_at: "2099-12-31T23:59:59"
    });
    return changed ? theme + "-event-experimental" : "skipped-schema";
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
      camera_roll_video_max_duration: VIDEO_SECONDS,
      max_file_size: VIDEO_BYTES,
      max_upload_bytes: VIDEO_BYTES,
      max_size_bytes: VIDEO_BYTES
    });
    // Do not invent a video_config schema when the server does not provide one.
    patchMedia(entries, "video_config");
    ["camera_roll_video_config", "camera_roll_video_upload_config", "video_upload_config"].forEach(function (key) {
      patchMedia(entries, key);
    });
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
    ["max_file_size", "max_upload_bytes", "max_size_bytes", "video_max_size_bytes", "camera_roll_video_max_size_bytes"].forEach(function (key) {
      entries[key] = String(VIDEO_BYTES);
    });
    ["video_upload_max_size_mb", "camera_roll_max_size_mb", "max_file_size_mb"].forEach(function (key) {
      if (entries[key] !== undefined) entries[key] = "100";
    });
    mergeEntry(entries, "overlays_v2_config", { suggestions_enabled: true });
    var added = captionPatch(entries);
    var widget = widgetPatch(entries);
    if (payload.state === "NO_CHANGE") payload.state = "UPDATE";
    log("firebase: v" + VERSION + " config target=" + VIDEO_SECONDS + "s; upload-bytes=" + VIDEO_BYTES + "; captions=" + added + "; widget=" + widget);
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
