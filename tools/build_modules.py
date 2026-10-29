"""Generate complete, mutually exclusive Shadowrocket module variants."""
from pathlib import Path

root = Path(__file__).resolve().parents[1]
version = "3.0.0"
base = "https://raw.githubusercontent.com/Cuongqtx11/locket60s_amthanh_mic/main/"
variants = {
    "locket60s_amthanh_mic.sgmodule": "aura-frame",
    "locket60s.sgmodule": "aura-frame",
    "locket30s.sgmodule": "aura-frame",
    "locket60s-widget.sgmodule": "aura-frame",
    "locket60s-no-widget.sgmodule": "",
    "locket60s-gold.sgmodule": "gold-frame",
    "locket60s-rose.sgmodule": "rose-frame",
    "locket60s-refresh.sgmodule": "aura-frame",
}
rc = r"^https://api\.revenuecat\.com/v1/(?:receipts|subscribers/[^/?#]+)/?(?:\?[^#]*)?$"
firebase = r"^https://firebaseremoteconfig\.googleapis\.com/v1/projects/locket-4252a/namespaces/firebase:fetch(?:\?[^#]*)?$"
request = r"^https://(?:api\.revenuecat\.com/v1/(?:receipts|subscribers/[^/?#]+)/?(?:\?[^#]*)?$|firebaseremoteconfig\.googleapis\.com/v1/projects/locket-4252a/namespaces/firebase:fetch(?:\?[^#]*)?$)"
for name, argument in variants.items():
    script = f"script-path={base}scripts/locket.js?v={version}"
    refresh = name == "locket60s-refresh.sgmodule"
    if refresh:
        script = "script-path=https://raw.githubusercontent.com/Cuongqtx11/locket60s_amthanh_mic/9bb85e7170fab5ffd8160889c934ddb2cc5ec51b/scripts/locket.js"
    option = f", argument={argument}" if argument else ""
    text = f"""#!name=Cuios • Locket 60s / 100 MB • {argument or 'no-widget'} • v{version}
#!desc=Mic & âm thanh kế thừa bản ổn định; cấu hình nhập 60s/100 MB, 4 ghi chú Cuios + 50 mẫu mới. Chỉ bật một module Locket.
#!author=Cuongqtx11 / Cuios
#!moduleUrl={base}{name}

[Script]
cuios_cache = type=http-request, pattern={request}, {script}, timeout=10
cuios_gold = type=http-response, pattern={rc}, {script}, requires-body=true, max-size=1048576, timeout=10
cuios_config = type=http-response, pattern={firebase}, {script}{option}, requires-body=true, max-size=1048576, timeout=10

[MITM]
hostname = %APPEND% api.revenuecat.com, firebaseremoteconfig.googleapis.com
"""
    if refresh:
        text = text.replace(f"• v{version}", f"• Refresh r1 • v{version}")
        text = text.replace("cuios_cache =", "cuios_refresh_cache =").replace("cuios_gold =", "cuios_refresh_gold =").replace("cuios_config =", "cuios_refresh_config =")
    (root / name).write_text(text)
print(f"Built {len(variants)} module entrypoints")
