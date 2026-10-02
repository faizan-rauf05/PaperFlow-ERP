import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireWarehouse } from "@/lib/apiAuth";
import { ACTIONS, writeAuditLog } from "@/lib/auditLog";
import { transferStock } from "@/lib/services/stock.service";
import { checkFactoryGlueLevels } from "@/lib/services/transfer-task.service";
import { parseNumberInput, requiredNumber } from "@/lib/validations/number-fields";

const location = z.enum(["WAREHOUSE", "FACTORY"]);
const transferSchema = z
  .object({
    materialId: z.string().trim().min(1, "Select the material"),
    from: location,
    to: location,
    quantity: z.preprocess(parseNumberInput, requiredNumber("Quantity").positive("Quantity must be greater than 0")),
    remarks: z.preprocess((v) => (v === "" ? undefined : v), z.string().trim().max(300).optional()),
  })
  .refine((t) => t.from !== t.to, { path: ["to"], message: "Choose two different locations" });

/**
 * POST /api/inventory/transfers — move stock between the warehouse and the
 * factory (Warehouse/Manager/Admin). Body is one transfer, or
 * `{ transfers: [...] }` to move several materials at once (e.g. a selection
 * of paper rolls) — all or nothing, in one transaction.
 */
export async function POST(request) {
  try {
    const authResult = await requireWarehouse();
    if (authResult.error) {
      return NextResponse.json(authResult.error.body, { status: authResult.error.status });
    }

    const body = await request.json();
    const parsed = z
      .array(transferSchema)
      .min(1, "Nothing to move")
      .max(200, "Move at most 200 items at once")
      .safeParse(Array.isArray(body.transfers) ? body.transfers : [body]);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid transfer" }, { status: 400 });
    }

    const userId = authResult.session.user.id;
    const results = await prisma.$transaction(
      async (tx) => {
        const out = [];
        for (const t of parsed.data) {
          out.push(await transferStock({ ...t, createdById: userId }, tx));
        }
        return out;
      },
      { timeout: 30000 },
    );

    await writeAuditLog({
      userId,
      action: ACTIONS.STOCK_TRANSFERRED,
      model: "InventoryTransaction",
      recordId: results[0].transferId,
      newValue: { count: results.length, transfers: parsed.data.map(({ materialId, from, to, quantity }) => ({ materialId, from, to, quantity })) },
    });
    if (parsed.data.some((t) => t.from === "FACTORY")) await checkFactoryGlueLevels();

    return NextResponse.json(
      { transferred: results.length, warnings: results.map((r) => r.warning).filter(Boolean) },
      { status: 201 },
    );
  } catch (error) {
    if (/not found|different locations|greater than 0/i.test(error.message || "")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("POST /api/inventory/transfers error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
