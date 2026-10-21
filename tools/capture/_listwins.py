import ctypes, ctypes.wintypes as wt
u = ctypes.windll.user32
PROC = ctypes.WINFUNCTYPE(ctypes.c_bool, wt.HWND, wt.LPARAM)
res = []
def cb(h, l):
    if not u.IsWindowVisible(h):
        return True
    n = u.GetWindowTextLengthW(h)
    if n == 0:
        return True
    b = ctypes.create_unicode_buffer(n + 1)
    u.GetWindowTextW(h, b, n + 1)
    r = wt.RECT()
    u.GetWindowRect(h, ctypes.byref(r))
    res.append((h, b.value, r.left, r.top, r.right - r.left, r.bottom - r.top))
    return True
u.EnumWindows(PROC(cb), 0)
for h, t, x, y, w, hh in res:
    if '微信' in t or 'xiaoguanjia' in t or 'miaoguanjia' in t or '喵' in t:
        print(h, repr(t), x, y, w, hh)
