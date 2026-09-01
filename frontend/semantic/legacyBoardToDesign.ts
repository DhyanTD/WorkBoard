import {
  applyDesignOperations,
  createEmptyDesignDocument,
  type ApplyDesignOperationsResult,
  type DesignOperation,
} from "@/domain/design";
import type { PersistedBoardState } from "@/storage/board/types";

export const LEGACY_DESIGN_ID = "design-legacy-board";
export const LEGACY_VIEW_ID = "view-legacy-board";

export const convertLegacyBoardToDesign = (
  board: PersistedBoardState,
): ApplyDesignOperationsResult => {
  const document = createEmptyDesignDocument(LEGACY_DESIGN_ID, {
    name: "Imported legacy Board",
    description: "A lossless annotation import from the browser-local version-1 Board.",
    assumptions: [
      "Imported strokes are annotations and do not imply semantic architecture.",
    ],
    decisions: [],
  });
  const operations: DesignOperation[] = [
    {
      kind: "add-element",
      element: {
        id: "system-legacy-board",
        kind: "software-system",
        name: "Unclassified legacy drawing",
        description: "Placeholder context for annotations imported from the legacy Board.",
        external: false,
      },
    },
    {
      kind: "add-view",
      view: {
        id: LEGACY_VIEW_ID,
        kind: "system-context",
        name: "Legacy Board import",
        systemId: "system-legacy-board",
        elementIds: ["system-legacy-board"],
        relationshipIds: [],
        boundaryIds: [],
        layout: {
          elements: {
            "system-legacy-board": { x: 40, y: 40, width: 240, height: 120 },
          },
          boundaries: {},
        },
      },
    },
    ...board.strokes.map<DesignOperation>((stroke, index) => ({
      kind: "add-annotation",
      annotation: {
        id: `annotation-legacy-${index}-${stroke.id ?? "stroke"}`,
        kind: "legacy-stroke",
        viewId: LEGACY_VIEW_ID,
        stroke: {
          ...stroke,
          points: stroke.points.map((point) => ({ ...point })),
          bounds: { ...stroke.bounds },
        },
      },
    })),
  ];
  return applyDesignOperations(document, operations);
};
