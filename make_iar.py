# make_iar.py — собирает печатную версию ИАР: титул вставляется вместо iframe
import re, pathlib

root = pathlib.Path(__file__).parent
title = (root / 'iar' / 'title.html').read_text(encoding='utf-8')
index = (root / 'iar' / 'index.html').read_text(encoding='utf-8')

body = re.search(r'<body[^>]*>(.*)</body>', title, re.S).group(1)
block = '<section class="titlepage">' + body + '</section>'
out, n = re.subn(r'<iframe[^>]*></iframe>', block, index, count=1)
if n == 0:
    raise SystemExit('ERROR: iframe не найден в iar/index.html')

css = """
.titlepage { height: 24cm; page-break-after: always; display: flex; flex-direction: column;
  font-family: 'Times New Roman', Times, serif; font-size: 14pt; line-height: 1.5; }
.titlepage .header { text-align: center; margin-bottom: 60px; }
.titlepage .header p { margin-bottom: 8px; }
.titlepage .title { flex: 1; display: flex; flex-direction: column; justify-content: center; text-align: center; }
.titlepage .title h1 { font-size: 20pt; margin-bottom: 40px; text-transform: uppercase; }
.titlepage .title h2 { font-size: 16pt; }
.titlepage .footer { text-align: center; }
.titlepage .footer p { margin-bottom: 8px; }
"""
out = out.replace('</style>', css + '</style>', 1)
(root / 'iar' / 'iar-print.html').write_text(out, encoding='utf-8')
print('OK: iar/iar-print.html собран')