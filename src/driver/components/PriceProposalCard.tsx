import { useState } from "react";

function friendlyError(error: unknown, fallback: string): string {
  if (import.meta.env.DEV) console.error("[price]", fallback, error);
  const message = error instanceof Error ? error.message : "";
  if (/already been sent|already sent/i.test(message)) {
    return "The price has already been sent.";
  }
  if (/no longer waiting|no longer assigned/i.test(message)) {
    return "This job is no longer waiting for a price.";
  }
  if (/valid .*price/i.test(message)) {
    return "Please enter a valid price.";
  }
  return fallback;
}

/**
 * Compact Hub-native price proposal. Sends raw pesos to the existing
 * set-price RPC (cents conversion mirrors the legacy dashboard);
 * all rules and validation live server-side.
 */
export function PriceProposalCard({
  label,
  onSubmit,
}: {
  label: string;
  onSubmit: (priceCents: number) => Promise<void>;
}) {
  const [raw, setRaw] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    const cleaned = raw.replace(/[₱,\s]/g, "");
    const pesos = Number(cleaned);
    if (!cleaned || !Number.isFinite(pesos) || pesos < 0) {
      setError("Please enter a valid price.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onSubmit(Math.round(pesos * 100));
      setRaw("");
    } catch (err) {
      setError(friendlyError(err, "Couldn't send the price. Please try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="hub-driver__price">
      <p className="hub-driver__card-title">{label}</p>
      <div className="hub-driver__price-row">
        <span aria-hidden="true">₱</span>
        <input
          type="text"
          inputMode="decimal"
          placeholder="0.00"
          aria-label="Price in pesos"
          value={raw}
          disabled={busy}
          onChange={(e) => {
            setRaw(e.target.value);
            setError("");
          }}
        />
        <button
          type="button"
          className="btn btn--primary"
          disabled={busy}
          onClick={() => void submit()}
        >
          {busy ? "Sending…" : "Send price"}
        </button>
      </div>
      {error ? (
        <p className="form-error-message" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
