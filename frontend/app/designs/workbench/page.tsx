import type { Metadata } from "next";
import SemanticWorkbench from "@/components/design/SemanticWorkbench";

export const metadata: Metadata = {
  title: "Design atelier · Open WorkBoard",
  description: "Review and edit a semantic software-system design.",
};

export default function DesignWorkbenchPage() {
  return <SemanticWorkbench />;
}
