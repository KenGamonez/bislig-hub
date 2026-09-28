import { useCallback, useEffect, useState } from "react";
import {
  ensureDriverPushSubscription,
  getVapidPublicKey,
  hasPushSubscription,
  isPushSupported,
  notificationPermission,
  requestNotificationPermission,
  saveDriverPushSubscription,
} from "../../legacy/lib/notifications";
import { useDriverSession } from "../hooks/useDriverSession";

type PushUiState =
  | { kind: "checking" }
  | { kind: "unsupported" }
  | { kind: "no-key" }
  | { kind: "blocked" }
  | { kind: "off" }
  | { kind: "enabling" }
  | { kind: "on" }
  | { kind: "error"; message: string };

/**
 * Driver push-notification control for the new driver shell (You page).
 * Reuses the existing helpers in legacy/lib/notifications exclusively:
 * no duplicated subscription logic. Subscribes only on an explicit tap,
 * saves under the signed-in driver's own id, and never reports enabled
 * unless the subscription row is stored.
 */
export function DriverPushControl() {
  const session = useDriverSession();
  const [state, setState] = useState<PushUiState>({ kind: "checking" });

  const refresh = useCallback(async () => {
    if (!isPushSupported()) {
      setState({ kind: "unsupported" });
      return;
    }
    if (!getVapidPublicKey()) {
      setState({ kind: "no-key" });
      return;
    }
    if (notificationPermission() === "denied") {
      setState({ kind: "blocked" });
      return;
    }
    setState((await hasPushSubscription()) ? { kind: "on" } : { kind: "off" });
  }, []);

  useEffect(() => {
    if (session.status !== "active") return;
    void refresh();
  }, [session.status, refresh]);

  const handleEnable = async () => {
    if (session.status !== "active" || !session.driver) return;
    setState({ kind: "enabling" });
    try {
      const permission = await requestNotificationPermission();
      if (permission !== "granted") {
        setState({ kind: "blocked" });
        return;
      }
      const ensured = await ensureDriverPushSubscription();
      if (ensured.status !== "subscribed") {
        setState(
          ensured.status === "denied"
            ? { kind: "blocked" }
            : ensured.status === "no-key"
              ? { kind: "no-key" }
              : ensured.status === "unsupported"
                ? { kind: "unsupported" }
                : {
                    kind: "error",
                    message:
                      ensured.status === "error"
                        ? ensured.message
                        : "Unable to enable push notifications.",
                  }
        );
        return;
      }
      await saveDriverPushSubscription(session.driver.id);
      setState({ kind: "on" });
    } catch (error) {
      setState({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unable to enable push notifications.",
      });
    }
  };

  if (session.status !== "active") {
    return null;
  }

  if (state.kind === "checking") {
    return (
      <div className="hub-driver__card">
        <p className="hub-driver__card-title">Phone notifications</p>
        <p className="hub-driver__card-sub">Checking notification support…</p>
      </div>
    );
  }

  if (state.kind === "unsupported") {
    return null;
  }

  return (
    <div className="hub-driver__card">
      <p className="hub-driver__card-title">Phone notifications</p>
      {state.kind === "on" ? (
        <p className="hub-driver__card-sub" role="status">
          Notifications enabled — you'll be alerted about new jobs even when
          Bislig Hub is in the background.
        </p>
      ) : state.kind === "blocked" ? (
        <p className="hub-driver__card-sub" role="alert">
          Notifications are blocked. Enable them in your browser or phone
          settings to receive job alerts, then return here.
        </p>
      ) : state.kind === "no-key" ? (
        <p className="hub-driver__card-sub" role="alert">
          Push notifications are not configured yet. Contact Bislig Hub to
          enable them.
        </p>
      ) : state.kind === "error" ? (
        <p className="form-error-message" role="alert">
          {state.message}{" "}
          <button
            type="button"
            className="link-button"
            onClick={() => void refresh()}
          >
            Retry
          </button>
        </p>
      ) : (
        <p className="hub-driver__card-sub">
          Get alerted about new jobs even when Bislig Hub is in the
          background.
        </p>
      )}
      {state.kind === "off" || state.kind === "enabling" ? (
        <button
          type="button"
          className="btn btn--primary btn--block"
          disabled={state.kind === "enabling"}
          onClick={() => void handleEnable()}
        >
          {state.kind === "enabling"
            ? "Enabling…"
            : "Enable notifications"}
        </button>
      ) : null}
    </div>
  );
}
