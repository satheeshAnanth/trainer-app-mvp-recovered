export const PRICING_MODEL = {
  trial: {
    code: "trial",
    label: "Free trial",
    clientLimit: 5,
    perClientCostInr: 0,
    description: "Free trial up to 5 clients.",
  },
  perClient: {
    code: "per_client",
    label: "Per-client pricing",
    clientLimit: 5000,
    perClientCostInr: 99,
    description: "INR 99 per active client per month after trial.",
  },
};

export function normalizeBillingModel(value) {
  const v = String(value ?? "").trim().toLowerCase();
  if (v === "per_client" || v === "per-client" || v === "perclient") return "per_client";
  return "trial";
}

export function pricingPayload() {
  return {
    billingModels: {
      trial: PRICING_MODEL.trial,
      perClient: PRICING_MODEL.perClient,
    },
    defaults: {
      billingModel: "trial",
    },
  };
}
