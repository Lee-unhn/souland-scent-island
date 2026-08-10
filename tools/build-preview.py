#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
把 public/ 裡的某一頁打包成「單一 HTML 檔」，寄給合作單位離線審閱用。

用途：頁面還沒上線、又要給廠商看內容時，產出一個雙擊就能開的自包含檔案。
      CSS 與圖片全部內嵌，對方不需要網址、不需要連到我們的伺服器。

用法：
    python tools/build-preview.py contest.html
    python tools/build-preview.py contest.html --out "C:/somewhere/檔名.html"

會做的事：
  1. styles.css      → 內嵌成 <style>
  2. assets/*.png    → 內嵌成 data: URI
  3. Meta Pixel      → 移除（預覽檔不該打追蹤事件）
  4. config.js       → 移除，購票鈕改成固定的「8月開放」停用狀態
  5. 站內連結        → 改指向正式站 https://soullandtw.com（避免點了 404）
  6. 頁面最上方      → 加一條「預覽版」提示條，避免對方誤以為已經上線

不會做的事：
  ・不內嵌 Google Fonts（中文字體檔太大）。對方開檔時有網路才會載到正式字體，
    離線會 fallback 到系統襯線體，版面不會跑掉。
"""

import argparse
import base64
import mimetypes
import re
import sys
from pathlib import Path

# Big5 機器上三串流都要轉 UTF-8，否則中文檔名與訊息會爆
for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8")
    except Exception:
        pass

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"

LIVE_SITE = "https://soullandtw.com"

BANNER = """<div style="background:#1D3450;color:#EFE7D4;text-align:center;padding:11px 18px;
  font:400 .82rem/1.6 'Noto Sans TC',system-ui,sans-serif;letter-spacing:.12em">
  內容確認用預覽版　·　此頁尚未上線，網址與正式站無關
</div>
"""


def data_uri(path: Path) -> str:
    mime = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    return f"data:{mime};base64," + base64.b64encode(path.read_bytes()).decode("ascii")


def build(page: str, out: Path) -> Path:
    src = PUBLIC / page
    if not src.exists():
        sys.exit(f"找不到頁面：{src}")

    html = src.read_text(encoding="utf-8")

    # 1. styles.css → <style>
    css = (PUBLIC / "styles.css").read_text(encoding="utf-8")
    html = re.sub(
        r'<link rel="stylesheet" href="styles\.css[^"]*">',
        "<style>\n" + css + "\n</style>",
        html,
        count=1,
    )

    # 2. assets/* → data: URI（含 <link rel="icon">）
    for m in sorted(set(re.findall(r'(?:src|href)="(assets/[^"]+?)(?:\?[^"]*)?"', html))):
        f = PUBLIC / m
        if f.exists():
            html = re.sub(re.escape(m) + r'(\?[^"]*)?', data_uri(f), html)

    # 3. Meta Pixel 整段移除
    html = re.sub(
        r"\s*<!-- Meta Pixel Code -->.*?<!-- End Meta Pixel Code -->",
        "",
        html,
        flags=re.S,
    )

    # 4. config.js 與其相依的 inline script 移除，購票鈕固定成停用狀態
    html = re.sub(r'\s*<script src="config\.js[^"]*"></script>', "", html)
    html = re.sub(r"\s*<script>\s*\(function\(\)\{.*?\}\)\(\);\s*</script>", "", html, flags=re.S)
    html = html.replace(
        "</body>",
        """<script>
  /* 預覽檔：沒有 config.js，購票鈕固定顯示「8月開放」並停用 */
  document.querySelectorAll('[data-ticket]').forEach(function(el){
    el.innerHTML = (el.getAttribute('data-ticket-label') || '購票') +
                   ' <span class="nav-soon">8月開放</span>';
    el.disabled = true;
  });
  document.querySelectorAll('[data-ticket-foot]').forEach(function(a){
    a.onclick = function(){ alert('購票將於 8 月開放'); };
  });
</script>
</body>""",
    )

    # 5. 站內相對連結 → 正式站絕對網址（預覽檔沒有其他頁，點了會 404）
    html = re.sub(r'href="index\.html"', f'href="{LIVE_SITE}" target="_blank" rel="noopener"', html)
    html = re.sub(
        r'href="vendor\.html"', f'href="{LIVE_SITE}/vendor.html" target="_blank" rel="noopener"', html
    )

    # 6. 預覽提示條（放在 <body> 之後、sticky nav 之前，捲動即消失）
    html = html.replace("<body>", "<body>\n" + BANNER, 1)

    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html, encoding="utf-8", newline="\n")
    return out


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("page", help="public/ 底下的檔名，例：contest.html")
    ap.add_argument("--out", default=None, help="輸出路徑（預設 preview/<page 標題>_預覽版.html）")
    a = ap.parse_args()

    out = Path(a.out) if a.out else ROOT / "preview" / (Path(a.page).stem + "_預覽版.html")
    p = build(a.page, out)
    print(f"完成：{p}")
    print(f"大小：{p.stat().st_size / 1024:.0f} KB")
