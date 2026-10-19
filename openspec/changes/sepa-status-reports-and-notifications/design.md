# Design — SEPA status reports, notifications, MT940, and the 2026 address cutover

## Context

The SEPA inspector detects the message type from the first child of `<Document>` (`CstmrCdtTrfInitn`, `CstmrDrctDbtInitn`, `BkToCstmrStmt`), walks the DOM namespace-blind (`localName` only, so every `.001.03` … `.001.09` revision decodes), renders a header card plus per-block rows, and runs gate functions of the shape `sepaCheckX(out, doc, detected)` that push `{ok, label, detail, clause}` rows into `out`. camt.053 already has a complete `Ntry` renderer (amount, `CdtDbtInd`, status, booking / value dates, `BkTxCd`, `NtryDtls/TxDtls` references and related parties).

Three of the four new inputs are ISO 20022 XML and slot into that detection switch. MT940 is not XML: it is a SWIFT FIN text block of `:tag:content` lines where content may continue on following lines until the next `:tag:` or the `-` end-of-text marker, optionally wrapped in `{1:…}{2:…}{4:` … `-}` block envelopes. No cryptography is involved anywhere in this change.

## Goals / Non-Goals

**Goals:**
- Seven input formats behind the same textarea / file input, same auto-detection, same results layout, same gate list.
- Every rejected pain.002 transaction readable by a non-banker: code, meaning, R-transaction type (Reject / Return / Refund / Refusal / Reversal), original references.
- MT940 balance chain checked with integer-cent arithmetic; a one-cent discrepancy is a ✗.
- The 15 November 2026 address gate behaves exactly like the Swiss QR-bill K-address gate: ⚠ before, ✗ from the date, clock-injectable for tests.

**Non-Goals:**
- No conversion (MT940 → camt.053 or back), no multi-file reconciliation.
- No VoP checks: nothing in a pain.001 carries a VoP result.
- No MT942 / MT950 / MT101 / MT103; no camt.056 / camt.029 (recall / resolution) in this slice.
- No full ExternalStatusReason1Code list (~300 codes); the dictionary covers the EPC-listed SEPA reasons and labels anything else "ISO 20022 external code — not in the SEPA subset".

## Decisions

1. **Extend `sepa`, do not add a tool.** Rationale: the user's mental model is "a file my bank sent me / a file I send my bank"; the inspector already owns that model and its related-tool links. A separate "MT940 tool" would duplicate the IBAN / amount / date rendering. Rejected alternative: a new `swiftmt` tool — more SEO surface, but a second copy of the statement renderer.
2. **pain.002 matching is by text, within the file.** `OrgnlEndToEndId` / `OrgnlInstrId` / `OrgnlPmtInfId` are shown as the key the originator must look up in its own pain.001; the tool does not accept a second file. Rejected alternative: two-file reconciliation — doubles the UI and most users receive the status report days after the batch.
3. **Reason codes are a flat inline table** `{code, meaning, rType, clause}` for the EPC-listed codes (EPC SCT / SDD Rulebooks, R-transaction reason code annexes), keyed by `StsRsnInf/Rsn/Cd`; `Rsn/Prtry` is shown verbatim with "proprietary — ask your bank". Meanings are STRINGS keys so they translate. Rejected alternative: vendoring the full ISO External Code Sets spreadsheet (~1 MB, licence unclear).
4. **camt.054 / camt.052 reuse the camt.053 `Ntry` renderer by call.** Only the header differs (`Ntfctn` / `Rpt` vs `Stmt`; `camt.052` has `Rpt/Bal` like a statement, `camt.054` has no balances). Batch vs single: an entry whose `NtryDtls/Btch/NbOfTxs` > 1 or that has more than one `TxDtls` child is rendered as a batch header with a sub-list.
5. **Bank-transaction codes decode via a small table** of ISO 20022 domain / family / sub-family codes (PMNT / RCDT / ESCT etc., ~40 rows covering the SEPA-relevant subset); unknown codes are shown raw with the `Prtry` text if present. Same rationale as decision 3.
6. **MT940 is tokenized, not regex-matched in one pass.** Step 1 strips an optional `{1:…}{2:…}{3:…}{4:` envelope and `-}` trailer; step 2 splits into `:tag:` records honoring continuation lines; step 3 parses `:61:` with a fixed-width-then-variable grammar (6-digit value date, optional 4-digit entry date, `D|C|RD|RC`, optional funds code letter, amount with comma, `N` or `F` + 3-char type, customer reference up to `//`, bank reference, optional supplementary line). Rejected alternative: a single regex per line — fails on the optional entry date and the `//` split in real bank files.
7. **Balance arithmetic in integer cents** from comma-decimal strings, as the `CtrlSum` gate does; opening (`:60F:` / `:60M:`) + Σ signed `:61:` amounts must equal closing (`:62F:` / `:62M:`); `RC` / `RD` reverse the sign. Multi-message files chain on `:28C:` sequence number and `60M` / `62M` intermediate balances; the chain gate requires message n's `:62M:` to equal message n+1's `:60M:`.
8. **Structured `:86:` sub-tags** (`?20`–`?29` purpose, `?30` bank code, `?31` account, `?32`/`?33` name, `?34` text key extension, `?60`–`?63` continuation; the German GVC / DK layout) are rendered as labelled rows only when the field starts with a 3-digit GVC and `?` separators; otherwise the six lines are shown verbatim.
9. **Address gates are dated by `Date.now()` with a test override**, the exact pattern of the Swiss QR-bill K-address gate (⚠ before 15 November 2026, ✗ from that date). The gate inspects every `PstlAdr` under `Dbtr`, `Cdtr`, `UltmtDbtr`, `UltmtCdtr`, `InitgPty`: unstructured means `AdrLine` only; hybrid means `AdrLine` plus structured children other than the two the EPC IGs permit alongside (`TwnNm`, `Ctry`); structured requires `TwnNm` and `Ctry`. Rejected alternative: a hard ✗ today — would flag files banks still accept for another month.
10. **Pure JS throughout; no Web Crypto.** Nothing to decide on the crypto axis.

## Risks / Trade-offs

- **ISO 20022 revisions.** pain.002 has ten published versions; element names are stable since .03 but `OrgnlGrpInfAndSts` cardinality and `StsRsnInf` nesting moved. Mitigation: `localName`-only walk and a tolerant "first match anywhere below this block" lookup, as the camt.053 walker already does.
- **MT940 dialects.** Banks differ on `:86:` layout, on whether `:61:` carries the entry date, and on `:28C:` formatting (`1/1`, `00001`). Mitigation: the grammar treats every optional sub-field as optional, the `:86:` structured view is opt-in by detection, and unknown tags are listed, never dropped.
- **Reason-code drift.** EPC adds codes with each rulebook (e.g. `SL01`, `CNOR`, `DNOR` arrived in 2019–2023). Mitigation: the table carries the rulebook version in a constant and the UI footnote; unknown codes degrade to "ISO external code" rather than ✗.
- **Date-gate false alarm.** A file prepared before 15 November 2026 for settlement after it is already wrong; the gate keys on the browser clock, not `ReqdExctnDt`. Mitigation: the ⚠ detail names the cutover date so the reader can judge; a follow-up may key on `ReqdExctnDt` / `ReqdColltnDt` when present.
- **False confidence.** An all-✓ camt / MT940 result means "this statement is internally consistent", not that the balances are the bank's. The summary line says so, in the inspector's existing verdict language.
