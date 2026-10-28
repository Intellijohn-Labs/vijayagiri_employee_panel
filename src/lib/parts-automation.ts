export interface PartsOrderPayload {
  event: "parts_order.created";
  claim: { id: string; ref: string; claimNo: string | null; customer: string; vehicle: string; regNo: string };
  order: { orderNo: string; vendor: string; etaDays: number; totalValue: number; createdBy: string; createdAt: string };
  destination: { branch: string; address: string; phone: string };
  parts: { code: string; description: string; quantity: number; unitPrice: number; vendor: string; lineTotal: number }[];
}

/**
 * Hands a placed parts order to the n8n workflow that notifies the vendor. Fire-and-forget: the order is already saved,
 * so a slow or failing webhook never blocks or undoes it. Returns whether a call was started.
 * Not in actions/claims.ts: every export of a "use server" file is a public endpoint, and this one must only run from the server.
 */
export function triggerPartsOrderAutomation(payload: PartsOrderPayload): boolean {
  const url = process.env.N8N_PARTS_ORDER_WEBHOOK_URL?.trim();
  if (!url) {
    console.log("n8n webhook URL pending - order saved locally");
    return false;
  }
  void fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal: AbortSignal.timeout(10_000) })
    .then((r) => {
      if (!r.ok) console.error(`n8n parts order webhook answered ${r.status}`);
    })
    .catch((e: unknown) => console.error("n8n parts order webhook failed:", e instanceof Error ? e.message : e));
  return true;
}
