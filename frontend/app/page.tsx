"use client";

import Toolbar from "@/components/board/Toolbar";
import BoardCanvas from "@/components/board/BoardCanvas";

export default function Home() {
  return (
    <div className="flex h-full flex-col">
      <Toolbar />
      <div className="relative flex-1 overflow-hidden">
        <BoardCanvas />
      </div>
    </div>
  );
}
