# Spec Delta — code-point-breakdown

## Purpose

Render any pasted string as a per-grapheme table of code points, encodings, general category, script and (for hazardous characters) name, with grapheme / code-point / byte counts, so a reader can see exactly which characters a string contains.

## ADDED Requirements

### Requirement: Grapheme segmentation
The tool SHALL split the input into extended grapheme clusters with `Intl.Segmenter` (granularity `grapheme`, UAX #29) and SHALL render one row per cluster listing every code point in it as `U+XXXX` (four to six uppercase hex digits). When `Intl.Segmenter` is unavailable the tool SHALL fall back to one row per code point and say so.

#### Scenario: Combining sequence is one row
- **WHEN** the input is `e` followed by U+0301 (combining acute accent)
- **THEN** one row is rendered showing `U+0065 U+0301`, and the counts header reads 1 grapheme, 2 code points, 3 UTF-8 bytes

#### Scenario: Emoji ZWJ sequence
- **WHEN** the input is the family emoji `U+1F468 U+200D U+1F469 U+200D U+1F467`
- **THEN** one row lists all five code points, the U+200D cells are labelled ZERO WIDTH JOINER with category Cf, and the header reads 1 grapheme, 5 code points, 18 UTF-8 bytes

### Requirement: Encoding lengths and counts
The tool SHALL report for each row the UTF-8 byte length (via `TextEncoder`, RFC 3629) and the UTF-16 code-unit count × 2, and SHALL show in the header the totals of graphemes, code points, UTF-8 bytes and UTF-16 bytes.

#### Scenario: Astral character lengths
- **WHEN** the input is U+1F600
- **THEN** the row shows 4 UTF-8 bytes and 4 UTF-16 bytes (one surrogate pair), and `String.length` is reported as 2 with a note that JavaScript counts UTF-16 code units

### Requirement: General category and script
The tool SHALL label each code point with its general category when it is one of Cf, Cc, Zs, Zl, Zp, Mn, Mc, Me, Co, Cn or Cs (evaluated with `\p{General_Category=…}` property escapes), with "letter / number / punctuation / symbol" as coarse labels otherwise, and SHALL label its script from the compact table Latin, Greek, Cyrillic, Armenian, Hebrew, Arabic, Devanagari, Han, Hiragana, Katakana, Hangul, Thai, Common, Inherited, or "other".

#### Scenario: Cyrillic lookalike labelled
- **WHEN** the input contains U+0430 (Cyrillic small a)
- **THEN** its row reads script Cyrillic, category letter, and the row is visually distinguished from the Latin rows around it

#### Scenario: Unassigned code point
- **WHEN** the input contains U+0378
- **THEN** its row reads category Cn with the detail "unassigned in this browser's Unicode tables"

### Requirement: Names for hazardous characters
The tool SHALL show a character name from a hand-maintained table of about 120 entries covering bidi controls (UAX #9), zero-width characters, tag characters U+E0000–U+E007F, variation selectors, SOFT HYPHEN, the no-break space family, IDEOGRAPHIC SPACE, combining diacritical marks (as a range label), BYTE ORDER MARK, interlinear annotation characters and U+FFFC / U+FFFD; other code points SHALL show no name rather than a guessed one.

#### Scenario: Bidi override named
- **WHEN** the input contains U+202E
- **THEN** the row reads RIGHT-TO-LEFT OVERRIDE, category Cf

#### Scenario: Ordinary letter has no name column entry
- **WHEN** the input contains U+0041
- **THEN** the name cell is empty (no full UCD is shipped)

### Requirement: Invisible characters rendered visibly
The tool SHALL never place a Cf, Cc, Co, Cn or Cs character as raw text inside the results table; such cells SHALL show the `U+XXXX` label and a placeholder glyph instead, and all cells SHALL be built with `createElement` / `textContent`.

#### Scenario: Override cannot reorder the table
- **WHEN** the input contains U+202E followed by text
- **THEN** the results table reads left-to-right in document order and the override appears only as its label

### Requirement: Offline operation
The tool SHALL perform segmentation, classification and counting entirely in the page.

#### Scenario: Input never leaves the page
- **WHEN** text is inspected while the browser's network log is observed
- **THEN** no request of any kind is issued (the document CSP is `connect-src 'none'`)
