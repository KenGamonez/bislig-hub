import { useEffect, useRef, useState } from "react";
import { supabase } from "../../legacy/lib/supabase";

/**
 * Unread badge counter for ride chat. Mirrors the legacy dashboard:
 * counts INSERTs on ride_messages from the passenger, deduped by id.
 * The RideChat component itself owns loading/sending/realtime; this
 * hook only drives the entry-point badge.
 */
export function useRideChatUnread(args: {
  rideId: string | null;
  chatOpen: boolean;
}) {
  const { rideId, chatOpen } = args;
  const [unread, setUnread] = useState(0);
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (chatOpen) setUnread(0);
  }, [chatOpen]);

  useEffect(() => {
    if (!rideId) return;
    const channel = supabase
      .channel(`hub-driver-ride-chat-${rideId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "ride_messages",
          filter: `ride_id=eq.${rideId}`,
        },
        (payload) => {
          const incoming = payload.new as {
            id?: string;
            sender_role?: string;
          };
          if (
            !incoming?.id ||
            incoming.sender_role !== "passenger" ||
            seenRef.current.has(incoming.id)
          ) {
            return;
          }
          seenRef.current.add(incoming.id);
          setUnread((count) => count + 1);
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [rideId]);

  const reset = () => {
    seenRef.current = new Set();
    setUnread(0);
  };

  return { unread, reset };
}
