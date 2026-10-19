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
    add_noun_supplements(files)

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



def corpus_glosses(files):
    """Most common gloss per lowercase token across the existing examples (used to fill the obvious words)."""
    from collections import Counter, defaultdict
    c = defaultdict(Counter)
    for items in files.values():
        for it in items:
            for m in it["meanings"]:
                for ex in m["examples"]:
                    for k, v in (ex.get("glosses") or {}).items():
                        c[k.lower()][v] += 1
    out = {k: v.most_common(1)[0][0] for k, v in c.items()}
    # Ambiguous function words: the most common corpus gloss is often wrong for a given sentence, so be neutral.
    out.update({"sich": "oneself", "mich": "me/myself", "dich": "you/yourself", "uns": "us/each other",
                "das": "that/the", "sie": "she/they/you (formal)", "mir": "me", "es": "it"})
    return out


def add_supplements(files):
    """Merge scripts/vocab/supplement_*.txt (words missing from the Goethe lists) into the level files.

    Block format is documented at the top of each supplement file. A word is skipped if the same
    word + part of speech already exists at any level, so the supplements never shadow the lists.
    """
    have = {(it["word"].lower(), it["pos"]) for items in files.values() for it in items}
    auto = corpus_glosses(files)
    for f in sorted(HERE.glob("supplement_*.txt")):
        if f.name == "supplement_nouns.txt":  # different format, see add_noun_supplements
            continue
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
                glosses = gl(g)
                have_k = {k.lower() for k in glosses}
                missing = []
                for t in TOKEN.findall(de):
                    if t.lower() in have_k:
                        continue
                    if t.lower() in auto:  # explicit glosses in the file always win
                        glosses[t] = auto[t.lower()]
                    else:
                        missing.append(t)
                if missing:
                    print(f"WARN {f.name} {word}: no gloss for {missing}")
                exs.append({"de": de, "en": en, "glosses": glosses})
            item = {"word": word, "pos": pos, "frequency": 0, "meanings": [{"english": english, "examples": exs}]}
            if notes:
                item["notes"] = notes
            files[level].append(item)
            have.add((word.lower(), pos))


NOUN_NOTES = {"n-Deklination", "adjektivische Deklination", "ohne Artikel", "die Niederlande"}
ARTICLE = {"m": "der", "f": "die", "n": "das", "p": "die"}
LEVEL = {"1": "A1", "2": "A2", "3": "B1", "0": "B2"}


def first_meaning(english):
    return re.split(r"[;,(]", english)[0].strip()


def load_gloss_dictionary():
    d = {}
    p = HERE / "gloss_dictionary.txt"
    if p.exists():
        for l in p.read_text(encoding="utf8").splitlines():
            if l.strip() and not l.startswith("#") and "=" in l:
                k, v = l.split("=", 1)
                d[k.strip().lower()] = v.strip()
    return d


def add_noun_supplements(files):
    """Merge supplement_nouns.txt (nouns missing from the Goethe lists) into the level files."""
    f = HERE / "supplement_nouns.txt"
    if not f.exists():
        return
    have = {(it["word"].lower(), it.get("article")) for items in files.values() for it in items if it["pos"] == "noun"}
    auto = corpus_glosses(files)
    dictionary = load_gloss_dictionary()
    rows = []
    for l in f.read_text(encoding="utf8").splitlines():
        if not l.strip() or l.startswith("#"):
            continue
        level, g, word, plural, english, de, en = l.split("|")
        rows.append((level, g, word, plural, english, de, en))
    # Headword and plural forms -> short meaning, so tokens that are other new nouns get glossed.
    own = {}
    for level, g, word, plural, english, de, en in rows:
        m = first_meaning(english)
        own.setdefault(word.lower(), m)
        pl = plural.split(";")[0].strip()
        if pl and pl != "-":
            own.setdefault(pl.lower(), m)
    unresolved = {}
    for level, g, word, plural, english, de, en in rows:
        art = ARTICLE[g]
        if (word.lower(), art) in have:
            continue
        pl, _, extra = plural.partition(";")
        pl, extra = pl.strip(), extra.strip()
        notes = []
        if g == "p":
            notes.append("Plural only")
        elif pl == "-":
            notes.append("No plural")
        elif pl:
            notes.append(f"Plural: die {pl}")
        if extra:
            notes.append(extra if extra in NOUN_NOTES else f"Also: {extra}")
        glosses = {}
        for t in TOKEN.findall(de):
            k = t.lower()
            if k in own:
                glosses[t] = own[k]
            elif k in dictionary:
                glosses[t] = dictionary[k]
            elif k in auto:
                glosses[t] = auto[k]
            else:
                unresolved.setdefault(k, []).append(word)
        item = {"word": word, "pos": "noun", "article": art, "frequency": 0,
                "meanings": [{"english": english, "examples": [{"de": de, "en": en, "glosses": glosses}]}]}
        if notes:
            item["notes"] = " · ".join(notes)
        files[LEVEL[level]].append(item)
        have.add((word.lower(), art))
    if unresolved:
        print(f"WARN supplement_nouns.txt: {len(unresolved)} tokens without a gloss (add them to gloss_dictionary.txt)")
        (HERE / "unresolved_glosses.txt").write_text("\n".join(f"{k}\t{'; '.join(v[:2])}" for k, v in sorted(unresolved.items())), encoding="utf8")


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
