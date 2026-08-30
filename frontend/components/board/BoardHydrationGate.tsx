"use client";

import {
  useEffect,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { hydrateBoardStore, useBoardStore } from "@/store/useBoardStore";

const subscribeToHydration = (onStoreChange: () => void) => {
  const notify = () => onStoreChange();
  const unsubscribeStart = useBoardStore.persist.onHydrate(notify);
  const unsubscribeFinish = useBoardStore.persist.onFinishHydration(notify);
  return () => {
    unsubscribeStart();
    unsubscribeFinish();
  };
};

const getHydrationSnapshot = () => useBoardStore.persist.hasHydrated();
const getServerHydrationSnapshot = () => false;

export default function BoardHydrationGate({
  children,
}: {
  children: ReactNode;
}) {
  const hasHydrated = useSyncExternalStore(
    subscribeToHydration,
    getHydrationSnapshot,
    getServerHydrationSnapshot,
  );

  useEffect(() => {
    if (!hasHydrated) void hydrateBoardStore();
  }, [hasHydrated]);

  if (!hasHydrated) {
    return (
      <div
        className="grid h-full place-items-center bg-[var(--canvas-background)] text-sm text-zinc-500 dark:text-zinc-400"
        role="status"
      >
        Restoring board…
      </div>
    );
  }

  return children;
}
