import { Document, Page, View, Text, Image, StyleSheet, renderToBuffer } from "@react-pdf/renderer";

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

function fmt(n) {
  return `$${Number(n || 0).toFixed(2)}`;
}

function lineSizeLabel(line) {
  const parts = [line.widthCm, line.heightCm, line.baseCm].filter((v) => v != null);
  if (!parts.length) return "—";
  return parts.map((v) => Number(v).toString()).join(" × ") + " cm";
}

export function QuoteDocument({ order, approver }) {
  const lines = order.lines || [];
  const subtotal = order.subtotal ?? lines.reduce((sum, l) => sum + Number(l.lineTotal || 0), 0);
  const total = order.proposedTotal ?? order.total ?? subtotal;

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
            <Text style={styles.orderNo}>{new Date().toLocaleDateString()}</Text>
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
            <Text style={styles.colSize}>Size (W×H×Base)</Text>
            <Text style={styles.colQty}>Qty</Text>
            <Text style={styles.colHandle}>Handle</Text>
            <Text style={styles.colColors}>Colors</Text>
            <Text style={styles.colPrice}>Unit Price</Text>
            <Text style={styles.colTotal}>Total</Text>
          </View>
          {lines.map((line) => (
            <View style={styles.tableRow} key={line.id}>
              <Text style={styles.colNo}>{line.lineNo}</Text>
              <Text style={styles.colSize}>{lineSizeLabel(line)}</Text>
              <Text style={styles.colQty}>{Number(line.quantity || line.plannedQty || 0).toLocaleString()}</Text>
              <Text style={styles.colHandle}>{line.withHandle ? "Yes" : "No"}</Text>
              <Text style={styles.colColors}>{line.colorCount ?? "—"}</Text>
              <Text style={styles.colPrice}>{fmt(line.unitPrice)}</Text>
              <Text style={styles.colTotal}>{fmt(line.lineTotal)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totalsBlock}>
          <View style={styles.totalsRow}>
            <Text>Subtotal</Text>
            <Text>{fmt(subtotal)}</Text>
          </View>
          {order.discount ? (
            <View style={styles.totalsRow}>
              <Text>Discount</Text>
              <Text>-{fmt(order.discount)}</Text>
            </View>
          ) : null}
          <View style={styles.grandTotalRow}>
            <Text>Total</Text>
            <Text>{fmt(total)}</Text>
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
          <Text style={styles.muted}>{new Date().toLocaleDateString()}</Text>
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
