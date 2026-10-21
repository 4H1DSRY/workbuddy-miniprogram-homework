import ctypes, ctypes.wintypes as wt
u = ctypes.windll.user32
PROC = ctypes.WINFUNCTYPE(ctypes.c_bool, wt.HWND, wt.LPARAM)
res = []
def cb(h, l):
    n = u.GetWindowTextLengthW(h)
    if n == 0:
        return True
    b = ctypes.create_unicode_buffer(n + 1)
    u.GetWindowTextW(h, b, n + 1)
    r = wt.RECT()
    u.GetWindowRect(h, ctypes.byref(r))
    pid = wt.DWORD()
    u.GetWindowThreadProcessId(h, ctypes.byref(pid))
    res.append((h, b.value, u.IsWindowVisible(h), r.left, r.top, r.right - r.left, r.bottom - r.top, pid.value))
    return True
u.EnumWindows(PROC(cb), 0)
for row in res:
    h, t, vis, x, y, w, hh, pid = row
    if w > 400 and hh > 300:
        print('hwnd=%d vis=%s %dx%d @%d,%d pid=%d  %s' % (h, vis, w, hh, x, y, pid, t[:70]))
