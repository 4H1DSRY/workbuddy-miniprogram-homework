import json, sys, time, subprocess, io
APP = 'miaoguanjia/app.json'
HWND = sys.argv[1]
PY = r'C:/Users/donny/.workbuddy/binaries/python/envs/default/Scripts/python.exe'
orig = open(APP, encoding='utf-8').read()
data = json.loads(orig)

def cap(out):
    subprocess.run([PY, '_cap.py', HWND, out], check=True)

try:
    for name, page in [('records', 'pages/records/records'),
                       ('mine', 'pages/mine/mine'),
                       ('cat-edit', 'pages/cat-edit/cat-edit')]:
        d = dict(data)
        d['entryPagePath'] = page
        open(APP, 'w', encoding='utf-8').write(json.dumps(d, ensure_ascii=False, indent=2))
        print('-> entryPagePath =', page)
        time.sleep(7)
        cap('_shots/page-%s.png' % name)
finally:
    open(APP, 'w', encoding='utf-8').write(orig)
    print('app.json 已还原')
