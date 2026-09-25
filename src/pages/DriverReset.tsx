import { DriverPasswordReset } from "../legacy/pages/DriverPasswordReset";
import { LegacyShell } from "../components/LegacyShell";

/** Driver password reset — ported working flow (recovery link target). */
export function DriverReset() {
  return (
    <LegacyShell tone="driver">
      <DriverPasswordReset />
    </LegacyShell>
  );
}

