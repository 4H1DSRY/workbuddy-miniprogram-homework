import ctypes, ctypes.wintypes as wt, sys
from PIL import Image
try:
    ctypes.windll.shcore.SetProcessDpiAwareness(2)
except Exception:
    pass
u = ctypes.windll.user32; g = ctypes.windll.gdi32
class BIH(ctypes.Structure):
    _fields_ = [('biSize', wt.DWORD), ('biWidth', ctypes.c_long), ('biHeight', ctypes.c_long),
                ('biPlanes', wt.WORD), ('biBitCount', wt.WORD), ('biCompression', wt.DWORD),
                ('biSizeImage', wt.DWORD), ('biXPelsPerMeter', ctypes.c_long),
                ('biYPelsPerMeter', ctypes.c_long), ('biClrUsed', wt.DWORD), ('biClrImportant', wt.DWORD)]
class BI(ctypes.Structure):
    _fields_ = [('bmiHeader', BIH), ('bmiColors', wt.DWORD * 3)]
hwnd = int(sys.argv[1]); out = sys.argv[2]
r = wt.RECT(); u.GetWindowRect(hwnd, ctypes.byref(r))
W, H = r.right - r.left, r.bottom - r.top
hdc = u.GetWindowDC(hwnd); mdc = g.CreateCompatibleDC(hdc)
bmp = g.CreateCompatibleBitmap(hdc, W, H); g.SelectObject(mdc, bmp)
g.BitBlt(mdc, 0, 0, W, H, hdc, 0, 0, 0x00CC0020)
ok = u.PrintWindow(hwnd, mdc, 2)
bi = BI(); bi.bmiHeader.biSize = ctypes.sizeof(BIH); bi.bmiHeader.biWidth = W
bi.bmiHeader.biHeight = -H; bi.bmiHeader.biPlanes = 1; bi.bmiHeader.biBitCount = 32
buf = ctypes.create_string_buffer(W * H * 4)
g.GetDIBits(mdc, bmp, 0, H, buf, ctypes.byref(bi), 0)
im = Image.frombuffer('RGBA', (W, H), buf, 'raw', 'BGRA', 0, 1).convert('RGB')
im.save(out)
print('saved', out, W, H, 'printwindow=', ok)
g.DeleteObject(bmp); g.DeleteDC(mdc); u.ReleaseDC(hwnd, hdc)
