import { useEffect, useState } from "react";
import { fetchDriverReputation, type ReputationSummary } from "../../legacy/lib/reputation";

export function useDriverReputation(driverId: string | null) {
  const [reputation, setReputation] = useState<ReputationSummary | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!driverId) {
      setReputation(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchDriverReputation(driverId)
      .then((summary) => {
        if (!cancelled) setReputation(summary);
      })
      .catch(() => {
        if (!cancelled) setReputation(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [driverId]);

  return { reputation, loading };
}