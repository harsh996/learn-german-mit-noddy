#!/usr/bin/env python3
"""Parse the Goethe A1/A2/B1 markdown word lists in knowledge_base/vocab_docs into scripts/vocab/parsed.json.

Output is German-only: headword, article, POS hint, source notes and cleaned example sentences.
enrich.py then adds translations / final POS / hover glosses and writes frontend/data/vocab/*.json.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
DOCS = ROOT / "knowledge_base" / "vocab_docs"
OUT = Path(__file__).with_name("parsed.json")

ARTICLE = re.compile(r"^(der|die|das)(?:/(der|die|das))?\s+(.+)$", re.I)
SENT_END = re.compile(r"[.!?\"“”]$")


def good_example(s: str) -> bool:
    s = s.strip()
    return len(s.split()) >= 2 and bool(SENT_END.search(s)) and "Siehe" not in s and "z. B." not in s[:5]


def clean_examples(raw: list[str]) -> list[str]:
    seen, out = set(), []
    for e in raw:
        e = e.strip().strip("*").strip()
        e = e.replace("das Book", "das Buch")
        if e == "Diese Sendung ist...":  # truncated in the source list
            continue
        if good_example(e) and e not in seen:
            seen.add(e)
            out.append(e)
    return out


def split_head(head: str, pos: str):
    """-> (word, article, extra_notes)"""
    head = re.sub(r"\((?:D|CH|A|D, CH|pl\.|Pl\.|Sg\.)\)", "", head).strip()
    notes = []
    if pos == "noun":
        m = ARTICLE.match(head)
        if m:
            art = m.group(1).lower() + (("/" + m.group(2).lower()) if m.group(2) else "")
            word = m.group(3).strip()
            word = {"(E-)Mail": "E-Mail", "(Fahr)Rad": "Fahrrad"}.get(word, word)
            word = re.sub(r"\s*\([^)]*\)\s*$", "", word).strip()
            if "(pl" in head.lower() or head.endswith("(Pl.)"):
                notes.append("plural only")
            return word, art, notes
    if pos == "verb":
        refl = re.search(r"\((sich)\)", head)
        if refl:
            head = re.sub(r"\(sich\)", "", head).strip()
            notes.append("reflexive (sich)")
        head = re.sub(r"\s*\((?:über|auf|an|von|mit)\)", "", head)
        head = re.sub(r"\s+", " ", head)
    head = re.sub(r"\s*\([^)]*\)\s*$", "", head).strip() if pos != "verb" else head
    return head.strip(), None, notes


HEAD_FIX = {
    "(ab)fahren": "abfahren", "(ab)fliegen": "abfliegen", "informieren (über)": "informieren",
    "leidtun / leid tun": "leidtun", "andern": "ändern", "dort / dorther / dorthin": "dort",
}


def entry(level, pos, head, examples, notes=None):
    head = re.sub(r"\s+", " ", head.replace("\u00a0", " ")).strip()
    head = HEAD_FIX.get(head, head)
    word, art, extra = split_head(head, pos)
    if word == "Rind":  # source has "der Rind"
        art = "das"
    n = [x for x in (notes or []) if x] + extra
    return {
        "level": level,
        "pos": pos,
        "word": word,
        "article": art,
        "notes": n,
        "examples": clean_examples(examples),
    }


# ---------- A1 (tables) ----------
A1_SECTIONS = {
    "Noun": "noun", "Verb": "verb", "Adjective": "adjective", "Adverb": "adverb",
    "Preposition": "preposition", "Conjunction": "conjunction", "Pronoun": "pronoun",
    "Interjection": "interjection", "Number": "number",
}


def parse_a1(text):
    out, pos = [], None
    for line in text.splitlines():
        if line.startswith("## "):
            pos = A1_SECTIONS.get(line[3:].strip())
            continue
        if not pos or not line.startswith("|") or set(line) <= set("|- "):
            continue
        cols = [c.strip() for c in line.strip().strip("|").split("|")]
        if cols[0] in ("Word / Entry", "Digits / Symbol"):
            continue
        if pos == "number":
            out.append(entry("A1", pos, cols[1], [], [cols[0]]))
            continue
        if pos in ("noun", "verb", "pronoun"):
            word, note, usage = cols[0], cols[1], cols[2]
        else:
            word, note, usage = cols[0], "", cols[1]
        note = "" if note in ("-", "") else note
        notes = []
        if pos == "verb":
            m = re.match(r"^\(?sich\)?\s+(\S+)", note)
            if m:  # "(sich) vorstellen" -> fix headword typos like "vorstellung"
                word = m.group(1)
                notes.append("reflexive (sich)")
            elif note:
                notes.append(note)
        elif pos == "pronoun" and note:
            notes.append(note)
        examples = [u for u in usage.split(" / ")]
        if pos == "pronoun" and " / " in word and "(" not in word:
            for w in word.split(" / "):
                out.append(entry("A1", pos, w, examples, notes))
            continue
        out.append(entry("A1", pos, word, examples, notes))
    return out


# ---------- A2 (bullets; nested or inline examples) ----------
A2_SECTIONS = [
    ("Nomen", "noun"), ("Verben", "verb"), ("Adjektive", "adjective"), ("Präpositionen", "preposition"),
    ("Konjunktionen", "conjunction"), ("Pronomina", "pronoun"), ("Partikeln", "interjection"),
]


def parse_a2(text):
    out, pos, cur = [], None, None
    for line in text.splitlines():
        if line.startswith("## "):
            pos = next((p for k, p in A2_SECTIONS if k in line), None)
            cur = None
            continue
        if not pos:
            continue
        m = re.match(r"^\* \*\*(.+?)\*\*(?:\s*\(\*?(.*?)\*?\))?\s*$", line)
        if m:
            head, inline = m.group(1), m.group(2)
            notes = []
            if pos == "verb" and "," in head:
                head, _, forms = head.partition(",")
                notes.append(forms.strip())
            elif pos == "noun" and "," in head:
                head = head.split(",")[0]
            if inline and not inline.startswith("*") and re.search(r"[.!?]", inline):
                ex = [inline]
            else:
                ex = []
                if inline:
                    notes.append(inline)
            if pos == "pronoun" and " / " in head and not ex:
                for w in head.split(" / "):
                    cur = entry("A2", pos, w, [], [])
                    out.append(cur)
                cur = None
                continue
            cur = entry("A2", pos, head.strip(), ex, notes)
            out.append(cur)
            continue
        m = re.match(r"^\s+\* \*(.+)\*\s*$", line)
        if m and cur is not None:
            cur["examples"] += clean_examples([m.group(1)])
    return out


# ---------- B1 (one line per entry) ----------
B1_SECTIONS = [
    ("Nomen", "noun"), ("Verben", "verb"), ("Adjektive", "adjective"), ("Präpositionen", "preposition"),
]


def parse_b1(text):
    out, pos = [], None
    for line in text.splitlines():
        if line.startswith("## "):
            pos = next((p for k, p in B1_SECTIONS if k in line), None)
            continue
        m = re.match(r"^\* \*\*(.+?)\*\*:\s*(.*)$", line)
        if not (m and pos):
            continue
        head, usage = m.group(1), m.group(2)
        notes = []
        if pos == "noun":
            head = head.split(" / ")[0].split(",")[0]
        elif pos == "verb":
            parts = [p.strip() for p in head.split(",")]
            head, forms = parts[0], ", ".join(parts[1:])
            if forms:
                notes.append(forms)
        head = re.sub(r"\s*\(\s*(?:an dem)\s*\)", "", head)
        if re.search(r"\(Pl\.\)", head):
            notes.append("plural only")
        examples = [e for e in re.split(r"\s*\d+\.\s+", usage) if e.strip()] if re.match(r"\d+\.", usage) else [usage]
        out.append(entry("B1", pos, head, examples, notes))
    return out


def main():
    a1 = parse_a1((DOCS / "goethe_a1_wordlist.md").read_text())
    a2 = parse_a2((DOCS / "goethe_zertifikat_a2_wortliste.md").read_text())
    b1 = parse_b1((DOCS / "goethe_b1_wordlist_structured.md").read_text())

    seen, entries, dropped = {}, [], []
    for e in a1 + a2 + b1:
        group = e["pos"] if e["pos"] in ("noun", "verb") else "other"
        key = (group, e["word"].lower(), e["article"] or "")
        if key in seen:
            first = seen[key]
            if first["level"] == e["level"]:  # same-level duplicate: merge examples
                for ex in e["examples"]:
                    if ex not in first["examples"]:
                        first["examples"].append(ex)
            else:
                dropped.append((e["level"], e["word"]))
            continue
        seen[key] = e
        entries.append(e)

    OUT.write_text(json.dumps(entries, ensure_ascii=False, indent=1))
    by = {}
    for e in entries:
        by.setdefault(e["level"], []).append(e)
    for lvl, es in by.items():
        print(lvl, len(es), "entries,", sum(len(e["examples"]) for e in es), "examples,",
              sum(1 for e in es if not e["examples"]), "without examples")
    print("dropped cross-level duplicates:", len(dropped))


if __name__ == "__main__":
    sys.exit(main())
