import pathlib, sys

root = pathlib.Path(r"d:\\vikramaditya")
old = "Ai Assistant"
new = "Ai Assistant"
patterns = ["*.md","*.py","*.json","*.html","*.js","*.tsx","*.ts","*.css","*.txt"]
for pattern in patterns:
    for p in root.rglob(pattern):
        try:
            text = p.read_text(encoding="utf-8")
        except Exception:
            continue
        if old in text:
            p.write_text(text.replace(old, new), encoding="utf-8")
            print(f"Updated {p}")
