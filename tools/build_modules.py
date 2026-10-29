"""Publish a content-addressed standalone runtime and complete module variants."""
from pathlib import Path
import hashlib,json

root=Path(__file__).resolve().parents[1]
version=json.loads((root/'package.json').read_text())['version']
base='https://raw.githubusercontent.com/Cuongqtx11/locket_cuios_stable/main/'
source=(root/'scripts/locket.js').read_bytes()
digest=hashlib.sha256(source).hexdigest()
relative='scripts/releases/locket-v'+version+'-'+digest[:12]+'.js'
release=root/relative
release.parent.mkdir(exist_ok=True)
release.write_bytes(source)
(root/'release.json').write_text(json.dumps({'version':version,'runtime':relative,'sha256':digest},indent=2)+'\n')
hosts=r'(?:api\.revenuecat\.com|api\.rc-backup\.com|api-production\.8-lives-cat\.io)'
rc=r'^https://'+hosts+r'/(?:v1|v2)/(?:receipts|subscribers)(?:[/?]|$)'
fb=r'^https://firebaseremoteconfig\.googleapis\.com/v1/projects/(?:locket-4252a|869942740286)/namespaces/firebase:fetch/?(?:\?[^#]*)?$'
fb_probe=r'firebaseremoteconfig\.googleapis\.com/v1/projects/[^/?#]+/namespaces/[^/?#]+:fetch/?(?:\?[^#]*)?$'
request=r'^https://(?:'+hosts+r'/(?:v1|v2)/(?:receipts|subscribers)(?:[/?]|$)|'+fb_probe+')'
variants={'locket_cuios_stable.sgmodule':'aura-frame','locket_cuios_no_widget.sgmodule':''}
for name,argument in variants.items():
    option=', argument='+argument if argument else ''
    text=fr"""#!name=Cuios • Profile thống nhất • v{version}{' • Giữ khung' if not argument else ''}
#!desc=60s/100 MiB, mic, 54 ghi chú; có trang chẩn đoán cục bộ. Chỉ bật một module Locket. Xem README về giới hạn native/cache.
#!author=Cuongqtx11 / Cuios
#!moduleUrl={base}{name}

[Script]
cuios4_status = type=http-request, pattern=^http://cuios-status\.invalid/(?:status|report\.json)(?:\?[^#]*)?$, script-path={base}{relative}, timeout=10
cuios4_https = type=http-request, pattern=^https://(?:api\.revenuecat\.com|firebaseremoteconfig\.googleapis\.com)/cuios-check(?:\?[^#]*)?$, script-path={base}{relative}, timeout=10
cuios4_request = type=http-request, pattern={request}, script-path={base}{relative}, timeout=10
cuios4_revenuecat = type=http-response, pattern={rc}, script-path={base}{relative}, requires-body=true, max-size=1048576, timeout=10
cuios4_firebase = type=http-response, pattern={fb}, script-path={base}{relative}{option}, requires-body=true, max-size=1048576, timeout=10

[MITM]
hostname = %APPEND% api.revenuecat.com, api.rc-backup.com, api-production.8-lives-cat.io, firebaseremoteconfig.googleapis.com
"""
    (root/name).write_text(text)
print('Published runtime',relative,'and',len(variants),'module variants')
