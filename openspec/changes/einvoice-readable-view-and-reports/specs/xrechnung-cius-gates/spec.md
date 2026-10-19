# Spec Delta — xrechnung-cius-gates

## Purpose

Detect an XRechnung invoice (the German CIUS of EN 16931, KoSIT XRechnung Specification 3.0.x and 2.x) in the UBL / CII inspector and run the BR-DE rule family in the house gate style, including Leitweg-ID syntax and check digits.

## ADDED Requirements

### Requirement: XRechnung detection
The inspector SHALL detect XRechnung when the CustomizationID (BT-24; UBL `cbc:CustomizationID`, CII `ram:GuidelineSpecifiedDocumentContextParameter/ram:ID`) starts with `urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0` or the `xrechnung_2.x` / `#conformant#…extension` variants, SHALL show the version in the header card, and SHALL run the BR-DE gates only when detected (XRechnung Specification, chapter "Spezifikationskennung").

#### Scenario: XRechnung 3.0 detected
- **WHEN** CustomizationID is `urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0`
- **THEN** the header card reads "Profile: XRechnung 3.0 (KoSIT)" and the gate list contains BR-DE rows

#### Scenario: PEPPOL document is not penalised
- **WHEN** CustomizationID is `urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0`
- **THEN** no BR-DE row appears and the existing PEPPOL gates run unchanged

### Requirement: Payment and seller-contact gates
The inspector SHALL display independent ✓ / ✗ rows for BR-DE-1 (payment instructions BG-16 present), BR-DE-2 (seller contact BG-6 present), BR-DE-5 (seller contact name BT-41), BR-DE-6 (seller contact telephone BT-42), and BR-DE-7 (seller contact e-mail BT-43), each row naming the rule id and the business term (XRechnung Specification, "Geschäftsregeln BR-DE").

#### Scenario: Missing seller contact
- **WHEN** an XRechnung carries no `cac:AccountingSupplierParty/cac:Party/cac:Contact`
- **THEN** BR-DE-2, BR-DE-5, BR-DE-6, and BR-DE-7 are each ✗, with BR-DE-2 explaining that the three contact details depend on it

#### Scenario: Complete contact and payment instructions
- **WHEN** BG-16 and BG-6 with name, telephone, and e-mail are present
- **THEN** BR-DE-1, -2, -5, -6, -7 are all ✓

### Requirement: Buyer reference and Leitweg-ID
The inspector SHALL display a ✓ / ✗ row for BR-DE-15 (buyer reference BT-10 present) and, when BT-10 matches the Leitweg-ID pattern `coarse[-fine]-check`, a second row verifying the Leitweg-ID: coarse part 2–12 digits, optional fine part 1–30 alphanumerics, two check digits by ISO 7064 MOD 97-10 over coarse and fine with letters A=10 … Z=35 (KoSIT Leitweg-ID specification), showing the expected check digits on failure.

#### Scenario: Valid Leitweg-ID
- **WHEN** BT-10 is `04011000-1234512345-06`
- **THEN** BR-DE-15 is ✓ and the Leitweg-ID row is ✓ showing coarse `04011000`, fine `1234512345`, check `06`

#### Scenario: Wrong check digits
- **WHEN** BT-10 is `04011000-1234512345-07`
- **THEN** BR-DE-15 is ✓ (present) and the Leitweg-ID row is ✗ naming MOD 97-10 and the expected `06`

#### Scenario: Buyer reference that is not a Leitweg-ID
- **WHEN** BT-10 is `PO-2026-77`
- **THEN** BR-DE-15 is ✓ and the Leitweg-ID row reads "not in Leitweg-ID form — a free buyer reference is permitted" as ⚠, not ✗

### Requirement: Type-code and payment-terms gates
The inspector SHALL display a ✓ / ✗ row for BR-DE-17 (invoice type code BT-3 is one of 326, 380, 381, 384, 389, 875, 876, 877; 383 and 386 are not permitted) and, when payment terms BT-20 contain `#SKONTO#`, a ✓ / ✗ row for BR-DE-18 (each skonto line has the form `#SKONTO#TAGE=n#PROZENT=n.nn#` optionally `#BASISBETRAG=n.nn#`, one per line, terminated by a line break).

#### Scenario: Forbidden type code
- **WHEN** BT-3 is `383`
- **THEN** BR-DE-17 is ✗ listing the permitted codes

#### Scenario: Malformed skonto line
- **WHEN** BT-20 is `#SKONTO#TAGE=14#PROZENT=2#`
- **THEN** BR-DE-18 is ✗ explaining that `PROZENT` needs two decimals (`2.00`)

### Requirement: Peppol German National Ruleset note
When the document is both XRechnung and addressed through PEPPOL (EAS-scheme endpoint ids present), the gate list SHALL carry an informational row stating that the Peppol German National Ruleset (in force since 17 February 2025) enforces the same BR-DE rules at German access points.

#### Scenario: Note shown on PEPPOL-routed XRechnung
- **WHEN** an XRechnung carries `cbc:EndpointID` with a `schemeID`
- **THEN** an info row names the Peppol German National Ruleset and its effective date

### Requirement: Offline operation and verdict language
BR-DE gates SHALL run without any network request, and an all-✓ result SHALL be phrased as conformance to XRechnung, never as the invoice being accepted or the buyer being verified.

#### Scenario: Input never leaves the page
- **WHEN** an XRechnung is inspected while the browser's network log is observed
- **THEN** no request of any kind is issued (the document CSP is `connect-src 'none'`)

#### Scenario: Clean result wording
- **WHEN** every BR-DE row and every EN 16931 row is ✓
- **THEN** the summary reads "Conforms to EN 16931 and XRechnung 3.0 BR-DE rules checked here — this does not establish that the receiving authority will accept it or who issued it"
