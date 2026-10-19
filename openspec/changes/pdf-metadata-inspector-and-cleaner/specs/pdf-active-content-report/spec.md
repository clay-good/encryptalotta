# Spec Delta — pdf-active-content-report

## Purpose

List and explain every action, script, and external reference in a PDF — OpenAction, JavaScript, Launch, URI, SubmitForm, GoToR, embedded files, external streams — without removing them, so the reader knows what the file can do when opened (ISO 32000-2:2020 §12.6).

## ADDED Requirements

### Requirement: Action discovery
The tool SHALL walk the catalog `/OpenAction` and `/AA`, the `/Names /JavaScript` name tree, each page's `/AA`, each annotation's `/A` and `/AA`, and each AcroForm field's `/AA`, following `/Next` chains, and SHALL list every action with its `/S` type (§12.6.4), its location (catalog, page n, annotation, field name), and the trigger event for `/AA` entries (§12.6.3).

#### Scenario: OpenAction with JavaScript
- **WHEN** the catalog has `/OpenAction << /S /JavaScript /JS (app.alert(1)) >>`
- **THEN** the active-content list shows "Catalog /OpenAction → JavaScript" with the first 200 characters of the script and the explanation "runs when the document opens (§12.6.4.17)"

#### Scenario: Chained actions
- **WHEN** a link annotation's `/A` has `/Next` pointing to a second action
- **THEN** both actions are listed under the same annotation in order

### Requirement: Explanations for code-executing and external actions
For `/JavaScript` (§12.6.4.17), `/Launch` (§12.6.4.6), `/URI` (§12.6.4.8), `/SubmitForm` (§12.6.4.11), `/GoToR` (§12.6.4.4), and `/ImportData` (§12.6.4.12) the tool SHALL show a one-line plain-language explanation, the sub-clause, and the target (script excerpt, program, URI, URL, or file) as text, and SHALL highlight the row.

#### Scenario: Launch action
- **WHEN** an annotation has `/A << /S /Launch /F (cmd.exe) >>`
- **THEN** the row reads "Launch → cmd.exe — asks the viewer to run an external program (§12.6.4.6)" and is highlighted

#### Scenario: SubmitForm target shown
- **WHEN** a field has `/AA << /D << /S /SubmitForm /F (https://example.net/collect) >> >>`
- **THEN** the row shows the URL as plain text (not a link) and the trigger "on mouse down"

### Requirement: Explanations for media and navigation actions
For `/Sound`, `/Movie`, `/RichMedia`, `/Rendition` (§12.6.4.9, §12.6.4.10, §12.6.4.14) the tool SHALL show a media explanation without highlight; for `/GoTo`, `/GoToE`, `/Named`, `/SetOCGState`, `/Hide`, `/Thread`, `/Trans` it SHALL show "navigation / display — no code, no external access" without highlight.

#### Scenario: Benign navigation
- **WHEN** a link has `/A << /S /GoTo /D [3 0 R /Fit] >>`
- **THEN** the row reads "GoTo — jumps to a page in this document" with no highlight

### Requirement: Embedded files and external streams
The tool SHALL list embedded files from the `/EmbeddedFiles` name tree and `/FileAttachment` annotations (§7.11.4, §12.5.6.15) with name, size, and MIME type, and SHALL list any stream whose dictionary has `/F` (external file reference, §7.3.8.2) or `/FFilter`.

#### Scenario: Attachment listed
- **WHEN** a PDF embeds `invoice.xml` via the name tree
- **THEN** the list shows "Embedded file: invoice.xml, 12.3 kB, text/xml"

### Requirement: Reported, not removed
The report SHALL state that this slice lists active content and does not remove it, and SHALL show a disabled "remove active content" toggle labelled "slice 2" whose tooltip explains that removal is planned as a separate change.

#### Scenario: Toggle is disabled
- **WHEN** active content is found
- **THEN** `#pdfmeta-active` shows the rows, the toggle is disabled with the slice-2 label, and the cleaner's summary notes "active content kept (n items)"

### Requirement: Offline operation and verdict language
The report SHALL be produced without any network request and SHALL phrase the absence of active content as "no actions, scripts, or external references found", never as the file being safe to open.

#### Scenario: Input never leaves the page
- **WHEN** a PDF is inspected while the browser's network log is observed
- **THEN** no request of any kind is issued; URIs found in actions are displayed as text, never fetched or made clickable (the document CSP is `connect-src 'none'`)

#### Scenario: Nothing found wording
- **WHEN** no action, script, embedded file, or external stream is present
- **THEN** the panel reads "No actions, scripts, embedded files, or external references found in the structures checked here — this does not establish that the file is safe to open; a viewer's own vulnerabilities are outside what a file inspection can show"
