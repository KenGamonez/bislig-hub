import { BecomeDriverExperience } from "../legacy/pages/BecomeDriverExperience";
import { LegacyShell, useLegacyViewChange } from "../components/LegacyShell";

/** Public driver application — ported working Bislig Ride flow. */
export function BecomeDriver() {
  const onViewChange = useLegacyViewChange();
  return (
    <LegacyShell>
      <BecomeDriverExperience
        view="Rider"
        onViewChange={onViewChange}
        onHome={() => onViewChange("Rider")}
      />
    </LegacyShell>
  );
}
