// Throwaway: measure horizontal overflow at mobile widths across every view.
// Discovers tool routes from the home grid at runtime, unions them with a few
// routes reachable only via the command palette, and additionally exercises the
// SEPA / UBL inspectors *after* a document is rendered — long conformance-gate
// rows are the real overflow risk, not the empty form.
// Run against an already-running server on :8765 (reuse the suite's webServer).
import { chromium } from 'playwright';

const ORIGIN = 'http://127.0.0.1:8765';
const WIDTHS = [320, 360, 414];

// Routes the home grid does not surface as anchors (palette-only / nested tools).
const EXTRA_ROUTES = [
  '#/utilities/cidr', '#/utilities/color', '#/utilities/base',
  '#/utilities/ubl', '#/utilities/lotl', '#/utilities/jwt',
];
const STANDALONE = ['/privacy.html'];

const browser = await chromium.launch();

// Discover routes from the home grid.
const disc = await (async () => {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 780 } });
  const page = await ctx.newPage();
  await page.goto(ORIGIN + '/index.html#/', { waitUntil: 'load' });
  await page.waitForTimeout(300);
  const routes = await page.evaluate(() =>
    [...new Set([...document.querySelectorAll('a[href*="#/"]')]
      .map(a => a.getAttribute('href')).filter(h => h && h.includes('#/')))]);
  await ctx.close();
  return routes;
})();

const routes = [...new Set([...disc, ...EXTRA_ROUTES])]
  .map(h => '/index.html' + h)
  .concat(STANDALONE);

function overflowProbe() {
  const de = document.documentElement;
  const over = de.scrollWidth - de.clientWidth;
  let widest = null, max = 0;
  if (over > 0) {
    for (const el of document.body.querySelectorAll('*')) {
      const r = el.getBoundingClientRect();
      if (r.right > max) {
        max = r.right;
        widest = el.tagName + '.' + (el.className && el.className.toString ? el.className.toString().slice(0, 40) : '');
      }
    }
  }
  return { over, scrollWidth: de.scrollWidth, clientWidth: de.clientWidth, widest, max: Math.round(max) };
}

let anyBad = false;
function report(w, name, m) {
  const bad = m.over > 0;
  if (bad) anyBad = true;
  console.log(`${bad ? 'XX' : 'ok'} w=${w} ${name.padEnd(26)} scroll=${m.scrollWidth} client=${m.clientWidth} over=${m.over}${bad ? '  widest=' + m.widest + ' right=' + m.max : ''}`);
}

// A canonical SEPA pain.001 and UBL Invoice exercise the long gate rows.
const SEPA_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03"><CstmrCdtTrfInitn>
<GrpHdr><MsgId>M1</MsgId><CreDtTm>2024-01-01T00:00:00</CreDtTm><NbOfTxs>1</NbOfTxs><CtrlSum>1.00</CtrlSum><InitgPty><Nm>Acme</Nm></InitgPty></GrpHdr>
<PmtInf><PmtInfId>P1</PmtInfId><PmtMtd>TRF</PmtMtd><NbOfTxs>1</NbOfTxs><CtrlSum>1.00</CtrlSum><ReqdExctnDt>2024-01-02</ReqdExctnDt>
<Dbtr><Nm>Acme</Nm></Dbtr><DbtrAcct><Id><IBAN>DE89370400440532013000</IBAN></Id><Ccy>EUR</Ccy></DbtrAcct>
<DbtrAgt><FinInstnId><BIC>COBADEFFXXX</BIC></FinInstnId></DbtrAgt><ChrgBr>SLEV</ChrgBr>
<CdtTrfTxInf><PmtId><EndToEndId>E1</EndToEndId></PmtId><Amt><InstdAmt Ccy="EUR">1.00</InstdAmt></Amt>
<CdtrAgt><FinInstnId><BIC>BNPAFRPPXXX</BIC></FinInstnId></CdtrAgt><Cdtr><Nm>Bob</Nm></Cdtr>
<CdtrAcct><Id><IBAN>FR1420041010050500013M02606</IBAN></Id></CdtrAcct></CdtTrfTxInf></PmtInf></CstmrCdtTrfInitn></Document>`;

const UBL_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
<cbc:CustomizationID>urn:cen.eu:en16931:2017</cbc:CustomizationID><cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID>
<cbc:ID>INV-1</cbc:ID><cbc:IssueDate>2024-01-01</cbc:IssueDate><cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode><cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>
<cac:AccountingSupplierParty><cac:Party><cac:PartyLegalEntity><cbc:RegistrationName>Acme</cbc:RegistrationName></cac:PartyLegalEntity></cac:Party></cac:AccountingSupplierParty>
<cac:AccountingCustomerParty><cac:Party><cac:PartyLegalEntity><cbc:RegistrationName>Bob</cbc:RegistrationName></cac:PartyLegalEntity></cac:Party></cac:AccountingCustomerParty>
<cac:TaxTotal><cbc:TaxAmount currencyID="EUR">19.00</cbc:TaxAmount><cac:TaxSubtotal><cbc:TaxableAmount currencyID="EUR">100.00</cbc:TaxableAmount><cbc:TaxAmount currencyID="EUR">19.00</cbc:TaxAmount><cac:TaxCategory><cbc:ID>S</cbc:ID><cbc:Percent>19</cbc:Percent><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:TaxCategory></cac:TaxSubtotal></cac:TaxTotal>
<cac:LegalMonetaryTotal><cbc:LineExtensionAmount currencyID="EUR">100.00</cbc:LineExtensionAmount><cbc:TaxExclusiveAmount currencyID="EUR">100.00</cbc:TaxExclusiveAmount><cbc:TaxInclusiveAmount currencyID="EUR">119.00</cbc:TaxInclusiveAmount><cbc:PayableAmount currencyID="EUR">119.00</cbc:PayableAmount></cac:LegalMonetaryTotal>
<cac:InvoiceLine><cbc:ID>1</cbc:ID><cbc:InvoicedQuantity unitCode="C62">1</cbc:InvoicedQuantity><cbc:LineExtensionAmount currencyID="EUR">100.00</cbc:LineExtensionAmount><cac:Item><cbc:Name>Widget</cbc:Name><cac:ClassifiedTaxCategory><cbc:ID>S</cbc:ID><cbc:Percent>19</cbc:Percent><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:ClassifiedTaxCategory></cac:Item><cac:Price><cbc:PriceAmount currencyID="EUR">100.00</cbc:PriceAmount></cac:Price></cac:InvoiceLine></Invoice>`;

const CII_XML = `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100" xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100" xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
<rsm:ExchangedDocument><ram:ID>FX-1</ram:ID><ram:TypeCode>380</ram:TypeCode><ram:IssueDateTime><udt:DateTimeString format="102">20240415</udt:DateTimeString></ram:IssueDateTime></rsm:ExchangedDocument>
<rsm:SupplyChainTradeTransaction>
<ram:IncludedSupplyChainTradeLineItem><ram:AssociatedDocumentLineDocument><ram:LineID>1</ram:LineID></ram:AssociatedDocumentLineDocument><ram:SpecifiedTradeProduct><ram:Name>Gadget</ram:Name></ram:SpecifiedTradeProduct><ram:SpecifiedLineTradeAgreement><ram:NetPriceProductTradePrice><ram:ChargeAmount>40.00</ram:ChargeAmount></ram:NetPriceProductTradePrice></ram:SpecifiedLineTradeAgreement><ram:SpecifiedLineTradeDelivery><ram:BilledQuantity unitCode="C62">3</ram:BilledQuantity></ram:SpecifiedLineTradeDelivery><ram:SpecifiedLineTradeSettlement><ram:SpecifiedTradeSettlementLineMonetarySummation><ram:LineTotalAmount>120.00</ram:LineTotalAmount></ram:SpecifiedTradeSettlementLineMonetarySummation></ram:SpecifiedLineTradeSettlement></ram:IncludedSupplyChainTradeLineItem>
<ram:ApplicableHeaderTradeAgreement><ram:SellerTradeParty><ram:Name>Fournisseur SARL</ram:Name></ram:SellerTradeParty><ram:BuyerTradeParty><ram:Name>Kaeufer GmbH</ram:Name></ram:BuyerTradeParty></ram:ApplicableHeaderTradeAgreement>
<ram:ApplicableHeaderTradeSettlement><ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode><ram:SpecifiedTradeSettlementHeaderMonetarySummation><ram:LineTotalAmount>120.00</ram:LineTotalAmount><ram:TaxBasisTotalAmount>120.00</ram:TaxBasisTotalAmount><ram:TaxTotalAmount currencyID="EUR">22.80</ram:TaxTotalAmount><ram:GrandTotalAmount>142.80</ram:GrandTotalAmount><ram:DuePayableAmount>142.80</ram:DuePayableAmount></ram:SpecifiedTradeSettlementHeaderMonetarySummation></ram:ApplicableHeaderTradeSettlement>
</rsm:SupplyChainTradeTransaction></rsm:CrossIndustryInvoice>`;

for (const w of WIDTHS) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 780 } });
  const page = await ctx.newPage();
  for (const route of routes) {
    await page.goto(ORIGIN + route, { waitUntil: 'load' });
    await page.waitForTimeout(120);
    report(w, route.replace('/index.html#/', '').replace('/index.html', 'home') || 'home', await page.evaluate(overflowProbe));
  }
  // Post-render: paste a document into SEPA + UBL inspectors and re-probe.
  for (const [name, route, input, btn, xml] of [
    ['sepa+doc', '#/utilities/sepa', '#sepa-input', '#btn-sepa-parse', SEPA_XML],
    ['ubl+doc', '#/utilities/ubl', '#ubl-input', '#btn-ubl-parse', UBL_XML],
    ['cii+doc', '#/utilities/ubl', '#ubl-input', '#btn-ubl-parse', CII_XML],
  ]) {
    await page.goto(ORIGIN + '/index.html' + route, { waitUntil: 'load' });
    await page.waitForTimeout(150);
    await page.fill(input, xml);
    await page.click(btn);
    await page.waitForTimeout(400);
    report(w, name, await page.evaluate(overflowProbe));
  }
  await ctx.close();
}
await browser.close();
console.log(anyBad ? 'RESULT: horizontal overflow found' : 'RESULT: no horizontal overflow at any width');
process.exit(anyBad ? 1 : 0);
