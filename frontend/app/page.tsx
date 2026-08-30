import Toolbar from "@/components/board/Toolbar";
import BoardCanvas from "@/components/board/BoardCanvas";
import ZoomControls from "@/components/board/ZoomControls";
import BoardHydrationGate from "@/components/board/BoardHydrationGate";

export default function Home() {
  return (
    <BoardHydrationGate>
      <div className="flex h-full flex-col bg-[var(--background)]">
        <Toolbar />
        <div className="relative flex-1 overflow-hidden bg-[var(--canvas-background)]">
          <BoardCanvas />
          <ZoomControls />
        </div>
      </div>
    </BoardHydrationGate>
  );
}
