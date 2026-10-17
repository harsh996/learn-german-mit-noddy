# Vocabulary word lists (A1 · A2 · B1)

`a1.json`, `a2.json`, `b1.json` are **generated** from the Goethe-Zertifikat word lists in
`knowledge_base/vocab_docs/`. Don't edit them by hand — change the source and rebuild:

```bash
python3 frontend/scripts/vocab/parse_wordlists.py   # markdown lists -> scripts/vocab/parsed.json
python3 frontend/scripts/vocab/build_data.py        # parsed.json + scripts/vocab/translations/*.txt -> these files
```

`parse_wordlists.py` extracts headword, article, notes and cleaned example sentences, and drops words that
repeat at a higher level (a word is shown at the first level it appears). `translations/*.txt` hold the English
meanings, final part of speech, plurals/verb forms, sentence translations and per-word hover glosses
(format documented at the top of `build_data.py`); entries are addressed by their position in `parsed.json`,
so re-run the parser **before** adding translations if the source lists change.

## Entry format

```json
{
  "word": "Haus", "article": "das", "pos": "noun", "frequency": 161,
  "notes": "Plural: die Häuser",
  "meanings": [
    { "english": "house, building",
      "examples": [ { "de": "In welchem Haus wohnst du?", "en": "Which house do you live in?",
                      "glosses": { "In": "in", "welchem": "which", "Haus": "house", "wohnst": "live", "du": "you" } } ] }
  ]
}
```

- `pos`: adjective | adverb | conjunction | interjection | noun | number | preposition | pronoun | verb
- `frequency` is the list order (A1 → A2 → B1, alphabetical within a level), not corpus frequency.
- Hover translations use the sentence's `glosses` first, then any list entry matching the word.
