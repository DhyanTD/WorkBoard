"use client";

import { create } from "zustand";
import {
  applyDesignOperations,
  COMMERCE_PLATFORM_DOCUMENT_ID,
  createProductionId,
  validateDesignDocument,
  type DesignDocument,
  type DesignElement,
  type DesignOperation,
  type DomainIssue,
  type Point,
  type Rectangle,
  type Relationship,
} from "@/domain/design";
import { designApiClient } from "@/client/designApi";
import {
  addElementOperations,
  addRelationshipOperations,
  copyElementOperations,
  deleteElementOperations,
  setElementRectangleOperation,
} from "@/semantic/editOperations";
import { convertLegacyBoardToDesign } from "@/semantic/legacyBoardToDesign";
import type { PersistedBoardState } from "@/storage/board/types";

export const ACTIVE_DESIGN_STORAGE_KEY = "open-workboard.active-design-id";

export type SemanticWorkbenchMode =
  | "select"
  | "connect"
  | "annotate"
  | "pan";

export type ElementChanges = {
  name?: string;
  description?: string;
  responsibilities?: string[];
};

export type RelationshipChanges = {
  description?: string;
  technology?: string;
};

type SemanticDesignState = {
  document: DesignDocument | null;
  currentRevisionId: string | null;
  activeViewId: string | null;
  selectedElementId: string | null;
  selectedRelationshipId: string | null;
  connectionSourceId: string | null;
  clipboardElement: DesignElement | null;
  past: DesignDocument[];
  future: DesignDocument[];
  mode: SemanticWorkbenchMode;
  status: "idle" | "loading" | "ready" | "saving" | "error";
  message: string | null;
  issues: DomainIssue[];
  scale: number;
  offset: Point;

  loadDesign: (designId?: string) => Promise<void>;
  setActiveView: (viewId: string) => void;
  setMode: (mode: SemanticWorkbenchMode) => void;
  selectElement: (elementId: string | null) => void;
  selectRelationship: (relationshipId: string | null) => void;
  chooseConnectionEndpoint: (elementId: string) => void;
  addElement: (containerType?: "application" | "datastore" | "queue") => void;
  updateSelectedElement: (changes: ElementChanges) => void;
  moveElement: (elementId: string, rectangle: Rectangle) => void;
  copySelectedElement: () => void;
  pasteElement: () => void;
  deleteSelectedElement: () => void;
  updateSelectedRelationship: (changes: RelationshipChanges) => void;
  addTextAnnotation: (text: string, position?: Point) => void;
  addFreehandAnnotation: (points: Point[]) => void;
  undo: () => void;
  redo: () => void;
  saveDraft: () => Promise<void>;
  importLegacyBoard: (board: PersistedBoardState) => Promise<void>;
  zoomBy: (factor: number) => void;
  panBy: (delta: Point) => void;
  resetCamera: () => void;
};

const cloneDocument = (document: DesignDocument) => structuredClone(document);

const currentView = (state: SemanticDesignState) =>
  state.document?.views.find((view) => view.id === state.activeViewId);

const persistActiveDesignId = (designId: string) => {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(ACTIVE_DESIGN_STORAGE_KEY, designId);
  }
};

const storedDesignId = () => {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACTIVE_DESIGN_STORAGE_KEY);
};

const initialMessage = "Select an element to inspect its semantic properties.";

export const useSemanticDesignStore = create<SemanticDesignState>((set, get) => {
  const applyOperations = (operations: DesignOperation[], message?: string) => {
    if (operations.length === 0) return false;
    const state = get();
    if (!state.document) return false;
    const result = applyDesignOperations(state.document, operations);
    if (!result.ok) {
      set({
        status: "error",
        issues: result.errors,
        message: result.errors[0]?.message ?? "The edit could not be applied.",
      });
      return false;
    }
    set({
      document: result.document,
      past: [...state.past, cloneDocument(state.document)],
      future: [],
      status: "ready",
      issues: result.warnings,
      message: message ?? null,
    });
    return true;
  };

  return {
    document: null,
    currentRevisionId: null,
    activeViewId: null,
    selectedElementId: null,
    selectedRelationshipId: null,
    connectionSourceId: null,
    clipboardElement: null,
    past: [],
    future: [],
    mode: "select",
    status: "idle",
    message: initialMessage,
    issues: [],
    scale: 1,
    offset: { x: 0, y: 0 },

    loadDesign: async (requestedDesignId) => {
      set({ status: "loading", message: "Loading design…", issues: [] });
      const designId =
        requestedDesignId ?? storedDesignId() ?? COMMERCE_PLATFORM_DOCUMENT_ID;
      const result = await designApiClient.getDesignHead(designId);
      if (!result.ok) {
        set({
          status: "error",
          message: result.error.message,
          currentRevisionId: result.currentRevisionId ?? null,
        });
        return;
      }
      const document = result.data.snapshot.document;
      persistActiveDesignId(document.id);
      set({
        document,
        currentRevisionId: result.data.currentRevisionId,
        activeViewId: document.views[0]?.id ?? null,
        selectedElementId: null,
        selectedRelationshipId: null,
        connectionSourceId: null,
        past: [],
        future: [],
        status: "ready",
        message: initialMessage,
        issues: [],
        scale: 1,
        offset: { x: 0, y: 0 },
      });
    },

    setActiveView: (activeViewId) =>
      set({
        activeViewId,
        selectedElementId: null,
        selectedRelationshipId: null,
        connectionSourceId: null,
        mode: "select",
        message: "View changed. Semantic IDs and relationships are preserved.",
      }),

    setMode: (mode) =>
      set({
        mode,
        connectionSourceId: mode === "connect" ? get().connectionSourceId : null,
        message:
          mode === "connect"
            ? "Choose a source element, then a destination element."
            : mode === "annotate"
              ? "Draw on the canvas to add a non-semantic annotation."
              : mode === "pan"
                ? "Drag the canvas to pan without changing the design."
                : initialMessage,
      }),

    selectElement: (selectedElementId) =>
      set({
        selectedElementId,
        selectedRelationshipId: null,
        message: selectedElementId ? null : initialMessage,
      }),

    selectRelationship: (selectedRelationshipId) =>
      set({
        selectedRelationshipId,
        selectedElementId: null,
        message: selectedRelationshipId ? null : initialMessage,
      }),

    chooseConnectionEndpoint: (elementId) => {
      const state = get();
      if (!state.document || !state.activeViewId) return;
      if (!state.connectionSourceId) {
        set({
          connectionSourceId: elementId,
          selectedElementId: elementId,
          message: "Source selected. Choose a different destination element.",
        });
        return;
      }
      if (state.connectionSourceId === elementId) {
        set({ message: "A relationship needs two different endpoints." });
        return;
      }
      const relationship: Relationship = {
        id: createProductionId("relationship"),
        sourceId: state.connectionSourceId,
        destinationId: elementId,
        description: "Uses",
      };
      const applied = applyOperations(
        addRelationshipOperations(
          state.document,
          state.activeViewId,
          relationship,
        ),
        "Relationship created. Select its label to describe the interaction.",
      );
      if (applied) {
        set({
          selectedRelationshipId: relationship.id,
          selectedElementId: null,
          connectionSourceId: null,
          mode: "select",
        });
      }
    },

    addElement: (containerType = "application") => {
      const state = get();
      const view = currentView(state);
      if (!state.document || !view) return;
      const element: DesignElement =
        view.kind === "system-context"
          ? {
              id: createProductionId("external-system"),
              kind: "software-system",
              name: "New external system",
              description: "Describe the capability this system provides.",
              external: true,
            }
          : {
              id: createProductionId("container"),
              kind: "container",
              name:
                containerType === "datastore"
                  ? "New datastore"
                  : containerType === "queue"
                    ? "New queue"
                    : "New application",
              description: "Describe this container's responsibility.",
              parentId: view.systemId,
              containerType,
            };
      if (
        applyOperations(
          addElementOperations(state.document, view.id, element),
          "Element added through a semantic operation batch.",
        )
      ) {
        set({ selectedElementId: element.id, selectedRelationshipId: null });
      }
    },

    updateSelectedElement: (changes) => {
      const state = get();
      const element = state.document?.elements.find(
        (candidate) => candidate.id === state.selectedElementId,
      );
      if (!element) return;
      applyOperations(
        [{ kind: "update-element", element: { ...element, ...changes } }],
        "Element semantics updated.",
      );
    },

    moveElement: (elementId, rectangle) => {
      const state = get();
      if (!state.document || !state.activeViewId) return;
      applyOperations(
        setElementRectangleOperation(
          state.document,
          state.activeViewId,
          elementId,
          rectangle,
        ),
      );
    },

    copySelectedElement: () => {
      const state = get();
      const element = state.document?.elements.find(
        (candidate) => candidate.id === state.selectedElementId,
      );
      if (!element) return;
      set({ clipboardElement: structuredClone(element), message: "Element copied." });
    },

    pasteElement: () => {
      const state = get();
      if (!state.document || !state.activeViewId || !state.clipboardElement) return;
      const copy = copyElementOperations(
        state.document,
        state.activeViewId,
        state.clipboardElement,
      );
      if (applyOperations(copy.operations, "Element pasted with a new stable ID.")) {
        set({ selectedElementId: copy.elementId, selectedRelationshipId: null });
      }
    },

    deleteSelectedElement: () => {
      const state = get();
      if (!state.document || !state.selectedElementId) return;
      const operations = deleteElementOperations(
        state.document,
        state.selectedElementId,
      );
      if (operations === null) {
        set({
          status: "error",
          message:
            "This element owns architectural content and cannot be removed until its children, boundary, or centered view are removed.",
        });
        return;
      }
      if (applyOperations(operations, "Element and its direct references removed.")) {
        set({ selectedElementId: null });
      }
    },

    updateSelectedRelationship: (changes) => {
      const state = get();
      const relationship = state.document?.relationships.find(
        (candidate) => candidate.id === state.selectedRelationshipId,
      );
      if (!relationship) return;
      applyOperations(
        [
          {
            kind: "update-relationship",
            relationship: { ...relationship, ...changes },
          },
        ],
        "Relationship semantics updated.",
      );
    },

    addTextAnnotation: (text, position = { x: 120, y: 80 }) => {
      const state = get();
      if (!state.activeViewId || text.trim().length === 0) return;
      applyOperations(
        [
          {
            kind: "add-annotation",
            annotation: {
              id: createProductionId("annotation"),
              kind: "text",
              viewId: state.activeViewId,
              text: text.trim(),
              position,
            },
          },
        ],
        "Review note added as a non-semantic annotation.",
      );
    },

    addFreehandAnnotation: (points) => {
      const state = get();
      if (!state.activeViewId || points.length < 2) return;
      const xs = points.map((point) => point.x);
      const ys = points.map((point) => point.y);
      applyOperations(
        [
          {
            kind: "add-annotation",
            annotation: {
              id: createProductionId("annotation-freehand"),
              kind: "legacy-stroke",
              viewId: state.activeViewId,
              stroke: {
                id: createProductionId("stroke"),
                tool: "pencil",
                color: "#e14b2a",
                lineWidth: 4,
                points: points.map((point) => ({ ...point })),
                bounds: {
                  minX: Math.min(...xs),
                  minY: Math.min(...ys),
                  maxX: Math.max(...xs),
                  maxY: Math.max(...ys),
                },
              },
            },
          },
        ],
        "Freehand mark added to the annotation layer.",
      );
    },

    undo: () => {
      const state = get();
      const previous = state.past.at(-1);
      if (!previous || !state.document) return;
      set({
        document: cloneDocument(previous),
        past: state.past.slice(0, -1),
        future: [cloneDocument(state.document), ...state.future],
        selectedElementId: null,
        selectedRelationshipId: null,
        message: "Last semantic edit undone.",
      });
    },

    redo: () => {
      const state = get();
      const next = state.future[0];
      if (!next || !state.document) return;
      set({
        document: cloneDocument(next),
        past: [...state.past, cloneDocument(state.document)],
        future: state.future.slice(1),
        selectedElementId: null,
        selectedRelationshipId: null,
        message: "Semantic edit restored.",
      });
    },

    saveDraft: async () => {
      const state = get();
      if (!state.document || !state.currentRevisionId) return;
      const validation = validateDesignDocument(state.document);
      if (!validation.ok) {
        set({
          status: "error",
          issues: validation.errors,
          message: "Resolve validation issues before saving.",
        });
        return;
      }
      set({ status: "saving", message: "Saving draft…" });
      const result = await designApiClient.saveDraft(
        state.document.id,
        state.document,
        state.currentRevisionId,
      );
      if (!result.ok) {
        set({
          status: "error",
          message: result.error.message,
          currentRevisionId: result.currentRevisionId ?? state.currentRevisionId,
          issues: result.error.issues ?? [],
        });
        return;
      }
      set({
        document: result.data.snapshot.document,
        currentRevisionId: result.data.currentRevisionId,
        past: [],
        future: [],
        status: "ready",
        message: "Draft saved with optimistic revision protection.",
        issues: [],
      });
    },

    importLegacyBoard: async (board) => {
      const converted = convertLegacyBoardToDesign(board);
      if (!converted.ok) {
        set({
          status: "error",
          issues: converted.errors,
          message: "The legacy Board could not be converted.",
        });
        return;
      }
      set({ status: "loading", message: "Importing legacy annotations…" });
      const created = await designApiClient.createDesign(converted.document);
      const head = created.ok
        ? created
        : created.error.code === "conflict"
          ? await designApiClient.getDesignHead(converted.document.id)
          : created;
      if (!head.ok) {
        set({ status: "error", message: head.error.message });
        return;
      }
      persistActiveDesignId(head.data.designId);
      set({
        document: head.data.snapshot.document,
        currentRevisionId: head.data.currentRevisionId,
        activeViewId: head.data.snapshot.document.views[0]?.id ?? null,
        selectedElementId: null,
        selectedRelationshipId: null,
        past: [],
        future: [],
        status: "ready",
        message:
          "Legacy strokes imported as annotations. The original IndexedDB record was retained.",
        issues: [],
        scale: 1,
        offset: { x: 0, y: 0 },
      });
    },

    zoomBy: (factor) =>
      set((state) => ({
        scale: Math.min(2, Math.max(0.4, state.scale * factor)),
      })),

    panBy: (delta) =>
      set((state) => ({
        offset: {
          x: state.offset.x + delta.x,
          y: state.offset.y + delta.y,
        },
      })),

    resetCamera: () => set({ scale: 1, offset: { x: 0, y: 0 } }),
  };
});
