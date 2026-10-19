# Proposal — SEPA status reports, notifications, MT940, and the 2026 address cutover

## Why

The shipped **SEPA ISO 20022 XML Inspector** decodes what a company *sends* (pain.001, pain.008) and the end-of-day statement it *receives* (camt.053), with 111 EPC Rulebook gates. It stops there. The files a treasury desk actually has to read when something goes wrong are different:

- **pain.002** — the bank's answer to a pain.001 / pain.008: accepted, rejected, pending, partially accepted, with an ISO reason code per rejected transaction (`AC01`, `AM04`, `MD01`…). Nobody outside a bank can read `RJCT / AC04` without a dictionary.
- **camt.054** (debit/credit notification) and **camt.052** (intraday report) — the same `Ntry` structure as camt.053, delivered during the day instead of after it.
- **MT940** — the SWIFT FIN statement that many banks still deliver alongside or instead of camt.053. Colon-tagged fixed-width lines, comma decimals, six-line `:86:` blocks, and a balance chain that has to add up.

People paste these into online "SEPA converters" that see every IBAN, every counterparty, and every reason a payment bounced. All four formats are plain text; the inspector already has the namespace-blind `DOMParser` walk, the camt.053 `Ntry` renderer, the IBAN / BIC validators, and the `{ok,label,detail,clause}` gate framework.

The same change adds the one gate the inspector is about to be wrong about. EPC 2025 rulebooks v1.1 (EPC153-22 v2.1) make structured postal addresses mandatory from **15 November 2026**: a pain.001 / pain.008 that still carries only `AdrLine` is rejected from that settlement date. Today the inspector only checks the AdrLine character set, count, and length.

## What Changes

- Extends the shipped SEPA inspector (`sepa`); **no new top-level tool** (57 stays 57). No OpenSpec baseline exists for the tool yet, so every capability below is written as a new capability.
- **pain.002 decoding** — `CstmrPmtStsRpt` header, group / payment-info / transaction status, reason codes with plain-language meaning and the R-transaction type, matching back to the original `EndToEndId` / `InstrId`; versions .03 through .10, namespace-blind.
- **camt.054 and camt.052 decoding** — `Ntfctn` / `Rpt` header, account, entries with bank-transaction-code decoding (domain / family / sub-family), entry details; reuses the camt.053 `Ntry` renderer.
- **MT940 decoding** — all standard tags, `:61:` sub-field parsing, multi-message chaining, balance arithmetic and `:86:` length gates, structured `:86:` sub-tags where present.
- **Structured-address readiness gates** — dated ⚠ / ✗ rows on pain.001 / pain.008 party addresses, same mechanism as the exemplar's K-address gate in the Swiss QR-bill change.
- Format auto-detection grows from three to seven inputs (root element for XML; `{1:` / `:20:` for FIN).

Out of scope (and the §7 non-goal it respects): no file conversion between formats; no reconciliation against an uploaded pain.001 (one file at a time); no Verification of Payee — VoP (mandatory for euro-area PSPs since 9 October 2025) is an API between PSPs, not an element of any file, so there is nothing for a file inspector to check and it is mentioned only as context in the address panel; no fetching of bank, BIC, or reason-code registries (§7.5 / §0.1) — the reason-code dictionary ships inline; no MT942 / MT950 / MT101 (different message families, not statements a customer reads).

## Capabilities

### New Capabilities
- `pain002-status-report-decoding`: decode ISO 20022 `pain.002` CustomerPaymentStatusReport (versions .03–.10) with the EPC reason-code dictionary.
- `camt054-and-camt052-decoding`: decode ISO 20022 `camt.054` BankToCustomerDebitCreditNotification and `camt.052` BankToCustomerAccountReport, reusing the camt.053 entry renderer, with ISO 20022 bank-transaction-code decoding.
- `mt940-statement-decoding`: decode SWIFT FIN MT940 Customer Statement Message, including `:61:` sub-fields, multi-message chaining, balance arithmetic, and structured `:86:` sub-tags.
- `structured-address-readiness-gates`: dated gates on pain.001 / pain.008 `PstlAdr` for the EPC 15 November 2026 structured-address mandate.

### Modified Capabilities
- none (the existing 111 pain.001 / pain.008 / camt.053 gates keep their behaviour; no baseline spec exists for them yet).

## Impact

- `index.html`: ~700 lines of inline JS in the SEPA section — pain.002 walker, camt.054 / 052 header adapters over the camt.053 `Ntry` renderer, MT940 tokenizer and tag walker, four gate families, one reason-code table (~60 entries) and one bank-transaction-code table (~40 domain / family / sub-family entries); ~90 STRINGS keys × 5 locales (reason-code meanings are translated; code letters are not). No new SEO keys beyond refreshed `tool.sepa.about.*` prose.
- Reuses: namespace-blind `DOMParser` walk, camt.053 `Ntry` renderer, `ibanValidate()`, BIC structure check, `ISO_3166_1_ALPHA2`, `ISO_4217`, integer-cent arithmetic from the `CtrlSum` gates, `Intl.NumberFormat` / `Intl.DateTimeFormat`, the gate framework.
- No new vendored file, no CSP change, page weight +~18 KB gzipped.
- Governing documents: ISO 20022 Message Definition Reports for pain.002, camt.052, camt.054; EPC SCT / SDD Customer-to-Bank Implementation Guidelines 2025 v1.1; EPC153-22 v2.1; SWIFT Standards MT, Category 9, MT940; ISO 20022 External Code Sets (ExternalStatusReason1Code, ExternalBankTransactionDomain1Code).
- Tests: new `tests/specs/NN-sepa-reports.spec.js` (number assigned at implementation; 29+). Confirm/flag pairs per format: a pain.002 with `ACCP` and one with `RJCT / AC04`; a camt.054 batch entry and a camt.052 single entry; an MT940 whose balances add up and one whose `:62F:` is off by one cent; a pain.001 with structured addresses (✓) and one with AdrLine only (⚠ before, ✗ from 15 November 2026, clock-injected); plus the suite's network-silence assertion.
