# Spec Delta — pain002-status-report-decoding

## Purpose

Decode the ISO 20022 `pain.002` CustomerPaymentStatusReport — the bank's accept / reject answer to a pain.001 or pain.008 — in the SEPA inspector, with every EPC reason code explained in plain language, entirely in the browser.

## ADDED Requirements

### Requirement: Message detection and header decoding
The inspector SHALL recognise a `<Document>` whose first child is `CstmrPmtStsRpt` as pain.002 regardless of namespace version (`pain.002.001.03` through `.10`, ISO 20022 Message Definition Report for pain.002) and SHALL render `GrpHdr` (`MsgId`, `CreDtTm`, `InitgPty` or `DbtrAgt` / `CdtrAgt`) in the existing SEPA header card.

#### Scenario: pain.002.001.10 header decodes
- **WHEN** the user pastes a pain.002 file whose namespace is `urn:iso:std:iso:20022:tech:xsd:pain.002.001.10`
- **THEN** the type badge reads "pain.002 — Customer Payment Status Report", the header card shows `MsgId` and `CreDtTm` formatted with `Intl.DateTimeFormat`, and the same file re-labelled `.03` decodes identically

### Requirement: Group, payment-information, and transaction status
The inspector SHALL render `OrgnlGrpInfAndSts` (`OrgnlMsgId`, `OrgnlMsgNmId`, `OrgnlNbOfTxs`, `OrgnlCtrlSum`, `GrpSts`), each `OrgnlPmtInfAndSts` (`OrgnlPmtInfId`, `PmtInfSts`), and each `TxInfAndSts` (`StsId`, `OrgnlInstrId`, `OrgnlEndToEndId`, `TxSts`, `AccptncDtTm`, `OrgnlTxRef` amount and parties) as separate rows (ISO 20022 pain.002 Message Definition Report).

#### Scenario: Original references are shown
- **WHEN** a `TxInfAndSts` carries `OrgnlInstrId` and `OrgnlEndToEndId`
- **THEN** both appear on the transaction row, labelled as the keys to look up in the originating pain.001 / pain.008

### Requirement: Status-code labels
The inspector SHALL label status codes from ISO 20022 ExternalPaymentGroupStatus1Code / ExternalPaymentTransactionStatus1Code: `ACTC` accepted technical, `ACCP` accepted, `ACSP` accepted settlement in process, `ACSC` settled, `ACWC` accepted with change, `RJCT` rejected, `PDNG` pending, `PART` partially accepted.

#### Scenario: Accepted group
- **WHEN** `GrpSts` is `ACCP` and no `TxInfAndSts` is present
- **THEN** the group row reads "ACCP — accepted (customer profile and syntax checks passed)" and the transaction table is replaced by "no transaction-level status reported"

#### Scenario: Partially accepted group with per-transaction statuses
- **WHEN** `GrpSts` is `PART` and three `TxInfAndSts` blocks carry `ACCP`, `ACCP`, `RJCT`
- **THEN** the transaction table lists three rows with their `OrgnlEndToEndId`, the rejected row is highlighted, and the summary reads "2 accepted, 1 rejected"

### Requirement: Reason-code dictionary
The inspector SHALL decode `StsRsnInf/Rsn/Cd` against an inline dictionary of the EPC-listed SEPA reason codes (EPC SCT Rulebook and EPC SDD Core Rulebook R-transaction reason-code annexes; ISO 20022 ExternalStatusReason1Code), rendering code, plain-language meaning, and R-transaction type (Reject / Return / Refund / Refusal / Reversal / Request for cancellation), followed by `AddtlInf` verbatim.

#### Scenario: AC04 rejection explained
- **WHEN** a `TxInfAndSts` has `TxSts` `RJCT` and `StsRsnInf/Rsn/Cd` `AC04`
- **THEN** the row reads "AC04 — account closed (Reject / Return)" with the `OrgnlEndToEndId` to look up in the originating pain.001, and `AddtlInf` text, if any, follows on its own line

### Requirement: Unlisted and proprietary reason codes
Codes outside the dictionary SHALL be shown raw as "ISO 20022 external code — not in the SEPA subset"; `Rsn/Prtry` SHALL be shown verbatim as proprietary. Neither case SHALL produce a ✗ gate for the code itself.

#### Scenario: Unlisted and proprietary codes
- **WHEN** `Rsn/Cd` is `ZZ99` or only `Rsn/Prtry` is present
- **THEN** the code is shown unchanged with the dictionary fallback text and no gate row is marked ✗ for the code itself

### Requirement: Status and reason gates
The inspector SHALL display independent ✓ / ✗ rows for: every status code is a member of its ISO 20022 external code set; a `RJCT` status at group, payment-info, or transaction level carries at least one `StsRsnInf`; a `PART` group status is accompanied by at least one accepted and one non-accepted transaction status (EPC SCT C2B Implementation Guidelines, pain.002 chapter).

#### Scenario: Rejection without a reason
- **WHEN** `TxSts` is `RJCT` and the block has no `StsRsnInf`
- **THEN** a ✗ gate row states "RJCT without StsRsnInf — the EPC IGs require a reason code on every rejection" and names the `OrgnlEndToEndId`

#### Scenario: PART without mixed statuses
- **WHEN** `GrpSts` is `PART` and every `TxSts` is `ACCP`
- **THEN** the PART gate is ✗ stating that a partially accepted group must carry at least one non-accepted transaction

### Requirement: Original-count and control-sum gates
The inspector SHALL display independent ✓ / ✗ rows for: `OrgnlNbOfTxs` equals the count of `TxInfAndSts` when transaction-level status is reported; `OrgnlCtrlSum`, when present, equals the integer-cent sum of `OrgnlTxRef/Amt` (same arithmetic as the pain.001 `CtrlSum` gate).

#### Scenario: Control sum mismatch
- **WHEN** `OrgnlCtrlSum` is `100.00` and the `OrgnlTxRef/Amt` values sum to `99.99`
- **THEN** the control-sum gate is ✗ with both figures, computed in integer cents

### Requirement: Offline operation and verdict language
The inspector SHALL decode pain.002 without any network request and SHALL phrase an all-✓ result as structural conformance, never as the payment having settled or the bank's answer being authentic.

#### Scenario: Input never leaves the page
- **WHEN** a pain.002 file is loaded while the browser's network log is observed
- **THEN** no request of any kind is issued (the document CSP is `connect-src 'none'`)

#### Scenario: Clean result wording
- **WHEN** every gate row is ✓
- **THEN** the summary reads "Status report conforms to the ISO 20022 pain.002 structure and the EPC IG rules checked here — this does not establish that the file came from your bank or that the accepted payments have settled"
