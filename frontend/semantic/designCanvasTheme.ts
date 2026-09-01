import type { ElementTone } from "@/semantic/designCanvasAdapter";

export type ElementPresentation = {
  accent: string;
  background: string;
  border: string;
  badge: string;
};

const ELEMENT_PRESENTATION: Record<ElementTone, ElementPresentation> = {
  person: {
    accent: "#9f3f26",
    background: "#fff6e9",
    border: "#9f3f26",
    badge: "PERSON",
  },
  "system-owned": {
    accent: "#173f5f",
    background: "#e7f0f4",
    border: "#173f5f",
    badge: "OWNED",
  },
  "system-external": {
    accent: "#52545a",
    background: "#f2f0eb",
    border: "#6f7074",
    badge: "EXTERNAL",
  },
  application: {
    accent: "#174f45",
    background: "#e7f2ed",
    border: "#174f45",
    badge: "APP",
  },
  datastore: {
    accent: "#6a3d73",
    background: "#f1e9f2",
    border: "#6a3d73",
    badge: "DATA",
  },
  queue: {
    accent: "#8b6713",
    background: "#faf0cf",
    border: "#8b6713",
    badge: "QUEUE",
  },
};

/** Presentation policy only; semantic element kinds never encode shape or color. */
export const elementPresentation = (tone: ElementTone) =>
  ELEMENT_PRESENTATION[tone];
