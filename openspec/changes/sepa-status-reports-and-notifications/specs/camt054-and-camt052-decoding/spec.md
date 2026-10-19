# Spec Delta — camt054-and-camt052-decoding

## Purpose

Decode ISO 20022 `camt.054` BankToCustomerDebitCreditNotification and `camt.052` BankToCustomerAccountReport in the SEPA inspector, reusing the shipped camt.053 entry renderer, with bank-transaction codes decoded, entirely in the browser.

## ADDED Requirements

### Requirement: Message detection and header decoding
The inspector SHALL recognise `BkToCstmrDbtCdtNtfctn` as camt.054 and `BkToCstmrAcctRpt` as camt.052 regardless of namespace version (ISO 20022 Message Definition Reports for camt.052 and camt.054, versions .02 through .12) and SHALL render `GrpHdr` plus each `Ntfctn` / `Rpt` header (`Id`, `CreDtTm`, `FrToDt`, `Acct/Id/IBAN`, `Acct/Ccy`, `Acct/Ownr/Nm`, `Acct/Svcr/FinInstnId/BICFI`) in the camt.053 header card, with `Rpt/Bal` rows (`OPBD`, `CLBD`, `ITBD`, `CLAV`) for camt.052 where present.

#### Scenario: camt.054 notification header
- **WHEN** the user pastes a camt.054.001.08 file with one `Ntfctn`
- **THEN** the badge reads "camt.054 — Debit/Credit Notification", the header card shows the account IBAN grouped in fours with its MOD-97 result, and no balance rows are shown (camt.054 carries none)

#### Scenario: camt.052 intraday report with balances
- **WHEN** the user pastes a camt.052 file whose `Rpt/Bal` blocks carry `OPBD` and `ITBD`
- **THEN** the balance rows read "Opening booked" and "Interim booked" with amounts via `Intl.NumberFormat` in `Amt/@Ccy`

### Requirement: Entry rendering through the camt.053 renderer
The inspector SHALL render each `Ntry` (`Amt` with `@Ccy`, `CdtDbtInd`, `RvslInd`, `Sts`, `BookgDt`, `ValDt`, `AcctSvcrRef`, `BkTxCd`) and each `NtryDtls/TxDtls` (`Refs/EndToEndId`, `Refs/MndtId`, `RmtInf/Ustrd` or `Strd/CdtrRefInf/Ref`, `RltdPties` debtor / creditor names and IBANs, `RltdAgts` BICs) with the same code path and layout as the shipped camt.053 statement view.

#### Scenario: Single-transaction entry
- **WHEN** an `Ntry` has one `TxDtls` child
- **THEN** the entry row shows amount, D/C, dates, and the single `EndToEndId`, with the related debtor or creditor name on the same row exactly as camt.053 renders it

#### Scenario: Batch entry
- **WHEN** an `Ntry` carries `NtryDtls/Btch/NbOfTxs` greater than 1 or more than one `TxDtls`
- **THEN** the entry is rendered as a batch header ("batch of n transactions, `PmtInfId` …") with an indented sub-row per `TxDtls`

### Requirement: Bank-transaction-code decoding
The inspector SHALL decode `BkTxCd/Domn/Cd`, `Domn/Fmly/Cd`, and `Domn/Fmly/SubFmlyCd` against an inline table of the SEPA-relevant subset of the ISO 20022 External Bank Transaction Code sets (`PMNT`, `RCDT`, `ICDT`, `RDDT`, `IDDT`, `ESCT`, `ESDD`, `RRTN`, `RPCR`, …), SHALL show the raw codes next to the decoded text, and SHALL show `BkTxCd/Prtry/Cd` with its `Issr` verbatim.

#### Scenario: Received SEPA credit transfer
- **WHEN** `Domn/Cd` is `PMNT`, `Fmly/Cd` is `RCDT`, `SubFmlyCd` is `ESCT`
- **THEN** the row reads "PMNT / RCDT / ESCT — Payments / Received credit transfer / SEPA credit transfer"

#### Scenario: Unknown sub-family
- **WHEN** `SubFmlyCd` is not in the inline table
- **THEN** the known parts are decoded, the unknown code is shown raw with "not in the SEPA subset", and no gate is marked ✗ for it

### Requirement: Notification and report gates
The inspector SHALL display independent ✓ / ✗ rows for: `CdtDbtInd` is `CRDT` or `DBIT`; `Amt/@Ccy` is a valid ISO 4217 code; entry `Sts` (or `Sts/Cd`) is `BOOK`, `PDNG`, or `INFO`; `Acct/Id/IBAN` passes MOD-97 and per-country structure (ISO 13616); a batch `NbOfTxs` equals the number of `TxDtls`; `BookgDt` is not later than `ValDt` (⚠ only — back-valued entries are legitimate but worth a look); for camt.052, `Rpt/Bal` amounts carry `CdtDbtInd`.

#### Scenario: Batch count mismatch
- **WHEN** `NtryDtls/Btch/NbOfTxs` is `3` and only two `TxDtls` children are present
- **THEN** the batch gate is ✗ naming both numbers

#### Scenario: Bad account IBAN
- **WHEN** `Acct/Id/IBAN` fails MOD-97
- **THEN** the IBAN gate is ✗ with the MOD-97 reason, and entries still render

### Requirement: Offline operation and verdict language
The inspector SHALL decode camt.054 and camt.052 without any network request and SHALL phrase an all-✓ result as internal consistency, never as the entries being the bank's authoritative record.

#### Scenario: Input never leaves the page
- **WHEN** a camt.054 or camt.052 file is loaded while the browser's network log is observed
- **THEN** no request of any kind is issued (the document CSP is `connect-src 'none'`)

#### Scenario: Clean result wording
- **WHEN** every gate row is ✓
- **THEN** the summary reads "Conforms to the ISO 20022 camt structure and the checks run here — this does not establish that the file is authentic or that these entries match your bank's ledger"
