import { Document, Page, View, Text, Image, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { bagSizeLabel, clicheSizeLabel } from "@/lib/order-labels";

const COMPANY_NAME = process.env.COMPANY_NAME || "PaperFlow Manufacturing";

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, fontFamily: "Helvetica", color: "#1a1a1a" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  companyName: { fontSize: 16, fontWeight: 700 },
  quoteTitle: { fontSize: 14, fontWeight: 700, textAlign: "right" },
  orderNo: { fontSize: 10, color: "#555", textAlign: "right", marginTop: 2 },
  section: { marginBottom: 14 },
  sectionLabel: { fontSize: 9, color: "#777", marginBottom: 3, textTransform: "uppercase" },
  customerName: { fontSize: 12, fontWeight: 700 },
  muted: { color: "#555" },
  table: { marginTop: 4, borderTop: "1px solid #ddd" },
  tableRow: { flexDirection: "row", borderBottom: "1px solid #eee", paddingVertical: 6 },
  tableHeaderRow: { flexDirection: "row", borderBottom: "1px solid #1a1a1a", paddingVertical: 4, fontWeight: 700 },
  colNo: { width: "6%" },
  colSize: { width: "24%" },
  colQty: { width: "12%", textAlign: "right" },
  colHandle: { width: "12%", textAlign: "center" },
  colColors: { width: "12%", textAlign: "center" },
  colPrice: { width: "17%", textAlign: "right" },
  colTotal: { width: "17%", textAlign: "right" },
  totalsBlock: { alignSelf: "flex-end", width: "45%", marginTop: 10 },
  totalsRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  grandTotalRow: { flexDirection: "row", justifyContent: "space-between", paddingTop: 6, marginTop: 4, borderTop: "1px solid #1a1a1a", fontWeight: 700, fontSize: 12 },
  approvalBlock: { marginTop: 36, paddingTop: 16, borderTop: "1px solid #ddd" },
  signatureImage: { width: 140, height: 50, objectFit: "contain", marginBottom: 4 },
  signatureLine: { width: 140, borderBottom: "1px solid #1a1a1a", marginBottom: 4, height: 40 },
  footer: { position: "absolute", bottom: 24, left: 32, right: 32, fontSize: 8, color: "#999", textAlign: "center" },
});

/** KWD to the fils (3 decimals), e.g. "51.615 KWD". */
function fmt(n) {
  return `${Number(n || 0).toFixed(3)} KWD`;
}

function fmtUnitPrice(n) {
  return n == null ? "—" : fmt(n);
}

/**
 * "2 Oct 2026" in Kuwait time — a written-out month can't be misread the
 * way 10/2/2026 can (2 Oct vs 10 Feb), and the server's clock may be UTC.
 */
function quoteDate(date = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kuwait", day: "numeric", month: "short", year: "numeric" })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  return `${parts.day} ${parts.month} ${parts.year}`;
}

/**
 * Proposed total (sales rep's price) vs the total the approver signed off
 * on. A revised price is shown as a "Price adjustment" row so the line
 * items still add up to the final total.
 */
function quoteTotals(order, lines) {
  const subtotal = Number(
    order.subtotal ?? lines.reduce((sum, l) => sum + Number(l.lineTotal || 0) + Number(l.clicheCharge || 0), 0),
  );
  const discount = Number(order.discount || 0);
  const proposed = Number(order.proposedTotal ?? order.total ?? subtotal - discount);
  const final = order.approvedTotal != null ? Number(order.approvedTotal) : proposed;
  const adjustment = Math.round((final - proposed) * 10000) / 10000;
  return { subtotal, discount, adjustment, final };
}

export function QuoteDocument({ order, approver }) {
  const lines = order.lines || [];
  const { subtotal, discount, adjustment, final } = quoteTotals(order, lines);
  // Clichés purchased for this order are billed at cost, one row each.
  const clicheRows = lines.filter((l) => Number(l.clicheCharge) > 0);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.companyName}>{COMPANY_NAME}</Text>
          </View>
          <View>
            <Text style={styles.quoteTitle}>QUOTATION</Text>
            <Text style={styles.orderNo}>{order.orderNo}</Text>
            <Text style={styles.orderNo}>{quoteDate()}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Customer</Text>
          <Text style={styles.customerName}>{order.customer?.name || "—"}</Text>
          {order.customer?.address ? <Text style={styles.muted}>{order.customer.address}</Text> : null}
          {order.customer?.phone ? <Text style={styles.muted}>{order.customer.phone}</Text> : null}
          {order.customer?.email ? <Text style={styles.muted}>{order.customer.email}</Text> : null}
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={styles.colNo}>#</Text>
            <Text style={styles.colSize}>Size (H × W × B)</Text>
            <Text style={styles.colQty}>Qty</Text>
            <Text style={styles.colHandle}>Handle</Text>
            <Text style={styles.colColors}>Colors</Text>
            <Text style={styles.colPrice}>Unit Price</Text>
            <Text style={styles.colTotal}>Total</Text>
          </View>
          {lines.map((line) => (
            <View style={styles.tableRow} key={line.id}>
              <Text style={styles.colNo}>{line.lineNo}</Text>
              <Text style={styles.colSize}>{bagSizeLabel(line)}</Text>
              <Text style={styles.colQty}>{Number(line.quantity || line.plannedQty || 0).toLocaleString()}</Text>
              <Text style={styles.colHandle}>{line.withHandle ? "Yes" : "No"}</Text>
              <Text style={styles.colColors}>{line.colorCount ?? "—"}</Text>
              <Text style={styles.colPrice}>{fmtUnitPrice(line.unitPrice)}</Text>
              <Text style={styles.colTotal}>{line.lineTotal == null ? "—" : fmt(line.lineTotal)}</Text>
            </View>
          ))}
          {clicheRows.map((line) => (
            <View style={styles.tableRow} key={`cliche-${line.id}`}>
              <Text style={styles.colNo} />
              <Text style={styles.colSize}>
                Cliché for line {line.lineNo}
                {line.cliche ? ` (${clicheSizeLabel(line.cliche)})` : ""}
              </Text>
              <Text style={styles.colQty}>1</Text>
              <Text style={styles.colHandle}>—</Text>
              <Text style={styles.colColors}>{line.cliche?.colorCount ?? "—"}</Text>
              <Text style={styles.colPrice}>{fmtUnitPrice(line.clicheCharge)}</Text>
              <Text style={styles.colTotal}>{fmt(line.clicheCharge)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totalsBlock}>
          <View style={styles.totalsRow}>
            <Text>Subtotal</Text>
            <Text>{fmt(subtotal)}</Text>
          </View>
          {discount ? (
            <View style={styles.totalsRow}>
              <Text>Discount</Text>
              <Text>-{fmt(discount)}</Text>
            </View>
          ) : null}
          {adjustment ? (
            <View style={styles.totalsRow}>
              <Text>Price adjustment</Text>
              <Text>
                {adjustment > 0 ? "+" : "-"}
                {fmt(Math.abs(adjustment))}
              </Text>
            </View>
          ) : null}
          <View style={styles.grandTotalRow}>
            <Text>Total</Text>
            <Text>{fmt(final)}</Text>
          </View>
        </View>

        <View style={styles.approvalBlock}>
          <Text style={styles.sectionLabel}>Approved By</Text>
          {approver?.signatureUrl ? (
            <Image src={approver.signatureUrl} style={styles.signatureImage} />
          ) : (
            <View style={styles.signatureLine} />
          )}
          <Text>{approver?.name || "—"}</Text>
          <Text style={styles.muted}>{approver?.role || ""}</Text>
          <Text style={styles.muted}>{quoteDate()}</Text>
        </View>

        <Text style={styles.footer}>
          This quotation requires customer approval before production begins. Please confirm acceptance with your sales representative.
        </Text>
      </Page>
    </Document>
  );
}

export async function renderQuotePdfBuffer(order, approver) {
  return renderToBuffer(<QuoteDocument order={order} approver={approver} />);
}
