// One rupee format for the whole app: ₹ + Indian digit grouping (1,25,000). Never $ or other currencies.
const pad2 = (n: number) => String(n).padStart(2, "0");

/**
 * formatINR(125000) -> "₹1,25,000"   formatINR(1250.5) -> "₹1,250.50"   formatINR("₹12000.00") -> "₹12,000"
 * decimals: "auto" (paise only when not zero, default), "always" (2 decimals), "never" (rounded rupees).
 */
export function formatINR(value: unknown, decimals: "auto" | "always" | "never" = "auto"): string {
  let n: number;
  if (typeof value === "number") n = value;
  else if (typeof value === "string") n = parseFloat(value.replace(/[^0-9.\-]/g, ""));
  else n = Number(value);
  if (!isFinite(n)) n = 0;

  const neg = n < 0;
  const abs = Math.abs(n);
  const rupees = decimals === "never" ? Math.round(abs) : Math.floor(abs + 1e-9);
  const paise = decimals === "never" ? 0 : Math.round((abs - rupees) * 100) % 100;

  const digits = String(rupees);
  let grouped = digits;
  if (digits.length > 3) {
    const head = digits.slice(0, -3);
    grouped = head.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + digits.slice(-3);
  }
  const showPaise = decimals === "always" || (decimals === "auto" && paise !== 0);
  return `${neg ? "-" : ""}₹${grouped}${showPaise ? "." + pad2(paise) : ""}`;
}
