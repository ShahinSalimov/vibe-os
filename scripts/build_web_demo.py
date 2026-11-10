"""Builds the demo-only web version as a self-contained folder with relative paths.

usage: python3 scripts/build_web_demo.py OUT_DIR [SELLER_CONTACT_URL]
Paths are made relative and the _expo folder is renamed, so the folder can be hosted
under any sub-path (artifact link, Netlify sub-folder, etc.).
"""
import glob, os, re, shutil, subprocess, sys

out = os.path.abspath(sys.argv[1])
contact = sys.argv[2] if len(sys.argv) > 2 else ''
env = dict(os.environ, EXPO_PUBLIC_DEMO_ONLY='1', EXPO_PUBLIC_SELLER_CONTACT_URL=contact, EXPO_OFFLINE='1', CI='1')
shutil.rmtree(out, ignore_errors=True)
subprocess.run(['npx', 'expo', 'export', '--platform', 'web', '--output-dir', out], check=True, env=env,
               stdout=subprocess.DEVNULL)
os.rename(os.path.join(out, '_expo'), os.path.join(out, 'expo'))
for f in glob.glob(os.path.join(out, 'expo/static/js/web/*.js')):
    s = open(f, encoding='utf-8').read()
    s = s.replace('"/_expo/', '"./expo/').replace('"/assets/', '"./assets/')
    open(f, 'w', encoding='utf-8').write(s)
idx = open(os.path.join(out, 'index.html')).read()
entry = re.search(r'src="/_expo/(static/js/web/[^"]+\.js)"', idx).group(1)
page = f'''<title>VIBE OS</title>
<style>
  :root {{ color-scheme: dark; --stage: #0B0A10; }}
  html {{ height: 100%; box-sizing: border-box; background: var(--stage); }}
  body {{ height: 100%; margin: 0; overflow: hidden; background: var(--stage); }}
  #root {{ display: flex; height: 100%; flex: 1; }}
</style>
<noscript>VIBE OS üçün JavaScript lazımdır.</noscript>
<div id="root"></div>
<script src="expo/{entry}" defer></script>
'''
open(os.path.join(out, 'index.html'), 'w').write(page)
for junk in ('favicon.ico', 'metadata.json'):
    p = os.path.join(out, junk)
    if os.path.exists(p): os.remove(p)
print('built', out)
