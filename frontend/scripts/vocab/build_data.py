#!/usr/bin/env python3
"""Turn hand-written translation chunks (scripts/vocab/translations/*.txt) + parsed.json into
frontend/data/vocab/{a1,a2,b1}.json.

Chunk format, one block per entry, blank line between blocks (index = position in parsed.json):

    #17
    p noun | Äpfel                      <- final POS | plural (nouns) or principal parts (verbs, e.g. "fährt ab, fuhr ab, ist abgefahren")
    m house, home ; 0,1                 <- English meaning ; indices of the example sentences it illustrates
    s The house is big. ## Das=the|Haus=house|ist=is|groß=big   <- translation ## word=gloss|word=gloss
    x Ich esse einen Apfel. ## I eat an apple. ## Ich=I|esse=eat|einen=an|Apfel=apple   <- only when the entry has no examples

Usage: build_data.py [--print-pending START COUNT] [--check]
"""
import argparse
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).parent
ROOT = HERE.parents[2]
PARSED, CACHE = HERE / "parsed.json", HERE / "enriched.json"
TRANS = HERE / "translations"
OUT_DIR = ROOT / "frontend" / "data" / "vocab"
POS = ["adjective", "adverb", "conjunction", "interjection", "noun", "number", "preposition", "pronoun", "verb"]
TOKEN = re.compile(r"[^\W\d_][\w'’-]*", re.U)


def entry_id(e):
    return f"{e['level']}:{e['pos']}:{e['word']}:{e['article'] or ''}".lower()


def valid(res, e):
    try:
        if res["pos"] not in POS or not res["meanings"]:
            return False
        if len(res["sentences"]) != len(e["examples"]):
            return False
        used = sorted(i for m in res["meanings"] for i in m["examples"])
        if e["examples"] and used != list(range(len(e["examples"]))):
            return False
        if not e["examples"] and not (res.get("extra") and res["extra"].get("de")):
            return False
        return all(m["english"].strip() for m in res["meanings"])
    except (KeyError, TypeError):
        return False


def build(entries, cache):
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    files = {"A1": [], "A2": [], "B1": [], "B2": []}
    skipped = 0
    for i, e in enumerate(entries):
        r = cache.get(entry_id(e))
        if not r:
            skipped += 1
            continue
        meanings = []
        for m in r["meanings"]:
            exs = []
            for idx in m["examples"]:
                s = r["sentences"][idx]
                exs.append({"de": e["examples"][idx], "en": s["en"], "glosses": s.get("glosses") or {}})
            if not e["examples"] and r.get("extra") and not exs and len(meanings) == (r.get("extra_meaning") or 0):
                x = r["extra"]
                exs.append({"de": x["de"], "en": x["en"], "glosses": x.get("glosses") or {}})
            meanings.append({"english": m["english"].strip(), "examples": exs})
        out = {"word": e["word"], "pos": r["pos"], "frequency": i + 1, "meanings": meanings}
        if e["article"] and r["pos"] == "noun":
            out["article"] = e["article"]
        notes = [n for n in e["notes"] if n]
        if r["pos"] == "noun" and r.get("plural"):
            notes.insert(0, f"Plural: die {r['plural']}")
        if r["pos"] == "verb" and r.get("plural") and not any("," in n for n in notes):
            notes.insert(0, r["plural"])  # for verbs the 2nd field of the "p" line holds principal parts
        if e["pos"] == "number" and notes:
            notes = [f"Digits: {notes[0]}"] + notes[1:]
        if notes:
            out["notes"] = " · ".join(notes)
        files[e["level"]].append(out)
    add_supplements(files)

    def collate(w):
        return w.casefold().translate(str.maketrans("äöüß", "aous"))

    n = 0
    for lvl, items in files.items():
        items.sort(key=lambda it: collate(it["word"]))
        for it in items:  # "frequency" doubles as list order: A1 -> A2 -> B1, alphabetical within a level
            n += 1
            it["frequency"] = n
        if not items:
            continue
        (OUT_DIR / f"{lvl.lower()}.json").write_text(json.dumps(items, ensure_ascii=False, indent=1))
        print(f"{lvl}: {len(items)} entries written")
    print(f"{skipped} entries not yet enriched (omitted)")



def add_supplements(files):
    """Merge scripts/vocab/supplement_*.txt (words missing from the Goethe lists) into the level files.

    Block format is documented at the top of each supplement file. A word is skipped if the same
    word + part of speech already exists at any level, so the supplements never shadow the lists.
    """
    have = {(it["word"].lower(), it["pos"]) for items in files.values() for it in items}
    for f in sorted(HERE.glob("supplement_*.txt")):
        pos = f.stem.removeprefix("supplement_").rstrip("s")  # supplement_prepositions.txt -> preposition
        for block in re.split(r"\n\s*\n", f.read_text()):
            lines = [l for l in block.strip().splitlines() if l.strip() and not l.startswith("#")]
            if not lines:
                continue
            level, word, notes, english = [p.strip() for p in lines[0].split("|")]
            if (word.lower(), pos) in have:
                continue
            exs = []
            for l in lines[1:]:
                de, en, g = [p.strip() for p in l[2:].split("##")]
                missing = [t for t in TOKEN.findall(de) if t.lower() not in {k.lower() for k in gl(g)}]
                if missing:
                    print(f"WARN {f.name} {word}: no gloss for {missing}")
                exs.append({"de": de, "en": en, "glosses": gl(g)})
            item = {"word": word, "pos": pos, "frequency": 0, "meanings": [{"english": english, "examples": exs}]}
            if notes:
                item["notes"] = notes
            files[level].append(item)
            have.add((word.lower(), pos))


def gl(s):
    out = {}
    for pair in s.split("|"):
        if "=" in pair:
            k, v = pair.split("=", 1)
            out[k.strip()] = v.strip()
    return out


def ingest(entries):
    cache, problems = {}, []
    for f in sorted(TRANS.glob("*.txt")):
        for block in re.split(r"\n\s*\n", f.read_text()):
            lines = [l for l in block.strip().splitlines() if l.strip()]
            if not lines or not lines[0].startswith("#"):
                continue
            idx = int(lines[0][1:].strip())
            e = entries[idx]
            r = {"id": entry_id(e), "pos": None, "plural": "", "meanings": [], "sentences": [], "extra": None, "extra_meaning": 0}
            for l in lines[1:]:
                kind, _, rest = l.partition(" ")
                if kind == "p":
                    pos, _, plural = rest.partition("|")
                    r["pos"], r["plural"] = pos.strip(), plural.strip()
                elif kind == "m":
                    eng, _, ex = rest.rpartition(";")
                    r["meanings"].append({"english": eng.strip(), "examples": [int(x) for x in ex.split(",") if x.strip()]})
                elif kind == "s":
                    en, _, g = rest.partition("##")
                    r["sentences"].append({"en": en.strip(), "glosses": gl(g)})
                elif kind == "x":
                    de, en, g = [p.strip() for p in rest.split("##")]
                    r["extra"] = {"de": de, "en": en, "glosses": gl(g)}
            if not valid(r, e):
                problems.append(f"{f.name} #{idx} {e['word']}: invalid structure")
                continue
            for ex, s in zip(e["examples"], r["sentences"]):
                missing = [t for t in TOKEN.findall(ex) if t not in s["glosses"] and t.lower() not in {k.lower() for k in s["glosses"]}]
                if missing:
                    problems.append(f"{f.name} #{idx} {e['word']}: no gloss for {missing}")
            cache[entry_id(e)] = r
    return cache, problems



def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--print-pending", nargs=2, type=int, metavar=("START", "COUNT"))
    a = ap.parse_args()
    entries = json.loads(PARSED.read_text())
    if a.print_pending:
        start, count = a.print_pending
        for i in range(start, min(start + count, len(entries))):
            e = entries[i]
            print(f"#{i} [{e['level']} {e['pos']}] {(e['article'] + ' ') if e['article'] else ''}{e['word']}"
                  + (f"  ({'; '.join(e['notes'])})" if e["notes"] else "") + "".join(f"\n   {j}: {x}" for j, x in enumerate(e["examples"])))
        return
    cache, problems = ingest(entries)
    CACHE.write_text(json.dumps(cache, ensure_ascii=False))
    for p in problems:
        print("WARN", p)
    build(entries, cache)


if __name__ == "__main__":
    main()
