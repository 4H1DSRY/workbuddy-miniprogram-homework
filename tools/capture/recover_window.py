# -*- coding: utf-8 -*-
"""把目标窗口从最小化还原，但不抢前台焦点。

用法: recover_window.py <hwnd>
SW_SHOWNOACTIVATE(4) 会按上次的尺寸位置显示窗口，且不激活它。
若窗口只是被隐藏（非最小化），同样适用。
"""
import ctypes
import sys
import ctypes.wintypes as wt

u = ctypes.windll.user32
hwnd = int(sys.argv[1])

fg = u.GetForegroundWindow()
print('原前台 hwnd =', fg)
print('isIconic =', bool(u.IsIconic(hwnd)), ' isVisible =', bool(u.IsWindowVisible(hwnd)))

u.ShowWindow(hwnd, 4)          # SW_SHOWNOACTIVATE
u.SetWindowPos(hwnd, 0, 0, 0, 0, 0, 0x0001 | 0x0002 | 0x0004 | 0x0010 | 0x0040)
#        HWND_TOP=0 omitted -> 0 means HWND_TOP; flags: NOSIZE|NOMOVE|NOZORDER|NOACTIVATE|SHOWWINDOW

print('after: isIconic =', bool(u.IsIconic(hwnd)), ' isVisible =', bool(u.IsWindowVisible(hwnd)))

r = wt.RECT()
u.GetWindowRect(hwnd, ctypes.byref(r))
print('rect =', r.left, r.top, r.right - r.left, r.bottom - r.top)
print('前台是否被抢:', u.GetForegroundWindow() != fg)
