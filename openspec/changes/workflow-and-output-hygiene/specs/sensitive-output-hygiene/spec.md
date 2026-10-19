# Spec Delta — sensitive-output-hygiene

## Purpose

Make the display, copying, and clearing of secret material consistent across every tool through one sensitivity registry: masked by default, optionally time-limited in the clipboard, and clearable in one action.

## ADDED Requirements

### Requirement: Sensitivity registry
The system SHALL hold a single registry naming, per tool, the inputs and outputs that carry secret material (passphrases, private keys, identities, derived keys, decrypted plaintext, mnemonics, Shamir secrets, TOTP secrets, steganographic payloads) and SHALL derive the masked rendering, the global clear, the clipboard timer, and the per-tool sensitivity badge from that registry alone.

#### Scenario: Registry completeness is audited
- **WHEN** the release audit runs
- **THEN** every `type="password"` input and every element marked as secret in `index.html` is present in the registry, and the audit fails otherwise

#### Scenario: Badge reflects registry
- **WHEN** a tool has at least one registered secret output
- **THEN** its view shows the "handles secrets — cleared on unload" badge, and tools with none show no badge

### Requirement: Masked rendering
Registered secret outputs SHALL render masked by default with a reveal toggle, SHALL keep the real value as the element's text so copy and handoff still work, and SHALL re-mask when the view is left.

#### Scenario: Derived key masked by default
- **WHEN** the PBKDF2 tool derives a key
- **THEN** the hex and Base64 outputs appear masked, the toggle reads "reveal" with an accessible label, and copying still copies the real value

#### Scenario: Re-mask on navigation
- **WHEN** the user reveals a private key and navigates to another tool
- **THEN** returning to the first view shows the key masked again

### Requirement: Timed clipboard overwrite
The system SHALL offer an opt-in setting (off by default) that, after a registered secret is copied, overwrites the clipboard with a single space after a configurable 15–300 s delay (default 60 s), SHALL show a countdown chip while the timer runs, SHALL cancel the timer when something else is copied, and SHALL not time copies of non-secret values.

#### Scenario: Secret copy with timer on
- **WHEN** the setting is on with a 60 s delay and the user copies an age identity
- **THEN** a chip counts down from 60 s and, at zero, the clipboard holds a single space

#### Scenario: Public value copy is untouched
- **WHEN** the setting is on and the user copies a public key
- **THEN** no countdown appears and the clipboard is not overwritten

#### Scenario: Overwrite refused by the browser
- **WHEN** the timer fires and the clipboard write is rejected
- **THEN** the chip reads "could not overwrite clipboard — clear it manually" and no exception surfaces

### Requirement: Global clear
The system SHALL provide a toolbar action and the `Esc Esc` key sequence (two presses within 500 ms, ignored during IME composition or while a dialog is open) that clears every registered secret input and output, empties the cross-tool handoff buffer, and cancels pending clipboard timers, reusing the existing unload-clearing routine.

#### Scenario: Esc Esc clears decrypted text
- **WHEN** decrypted plaintext is shown in the Text Messages tool and the user presses `Esc` twice quickly
- **THEN** the plaintext pane, the passphrase field, and the private-key field are empty and a brief "cleared" confirmation appears

#### Scenario: Public results survive
- **WHEN** the global clear runs on the Verify tool after a successful verification
- **THEN** the public key and the verification status remain, because they are not registered as secrets

### Requirement: Setting storage is limited to preferences
The clipboard-timer preference SHALL be the only new value stored in `localStorage`, alongside locale and theme; no secret, input, or output SHALL ever be persisted.

#### Scenario: Storage audit
- **WHEN** the test suite inspects `localStorage` after exercising every tool
- **THEN** only the locale, theme, and clipboard-timer keys exist
