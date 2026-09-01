"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import SemanticCanvas from "@/components/design/SemanticCanvas";
import { BOARD_STORAGE_KEY, boardIndexedDbStorage } from "@/storage/board/boardStorage";
import {
  useSemanticDesignStore,
  type SemanticWorkbenchMode,
} from "@/store/useSemanticDesignStore";

type ToolButtonProps = {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
};

function ToolButton({ label, active = false, disabled = false, onClick }: ToolButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`border px-3 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] transition disabled:cursor-not-allowed disabled:opacity-35 ${
        active
          ? "border-[#e14b2a] bg-[#e14b2a] text-white"
          : "border-[#bbb8ae] bg-[#fffdf8] text-[#32332f] hover:border-[#32332f]"
      }`}
    >
      {label}
    </button>
  );
}

const modeLabel: Record<SemanticWorkbenchMode, string> = {
  select: "Select",
  connect: "Connect",
  annotate: "Pencil",
  pan: "Pan",
};

function PropertiesPanel() {
  const document = useSemanticDesignStore((state) => state.document);
  const selectedElementId = useSemanticDesignStore(
    (state) => state.selectedElementId,
  );
  const selectedRelationshipId = useSemanticDesignStore(
    (state) => state.selectedRelationshipId,
  );
  const updateElement = useSemanticDesignStore(
    (state) => state.updateSelectedElement,
  );
  const updateRelationship = useSemanticDesignStore(
    (state) => state.updateSelectedRelationship,
  );
  const addTextAnnotation = useSemanticDesignStore(
    (state) => state.addTextAnnotation,
  );
  const [note, setNote] = useState("");
  const element = document?.elements.find(
    (candidate) => candidate.id === selectedElementId,
  );
  const relationship = document?.relationships.find(
    (candidate) => candidate.id === selectedRelationshipId,
  );

  const submitNote = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    addTextAnnotation(note);
    setNote("");
  };

  return (
    <aside className="flex min-h-0 w-[310px] shrink-0 flex-col border-l border-[#c9c5b9] bg-[#f4f0e7]">
      <div className="border-b border-[#c9c5b9] px-5 py-4">
        <div className="font-mono text-[9px] tracking-[0.18em] text-[#77736b]">
          INSPECTOR / SEMANTIC
        </div>
        <h2 className="mt-1 font-serif text-2xl text-[#242520]">
          {element ? "Element" : relationship ? "Relationship" : "Review desk"}
        </h2>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        {element ? (
          <div key={element.id} className="space-y-5" data-testid="element-inspector">
            <InspectorField label="Stable ID">
              <code className="block break-all border border-[#d3cfc4] bg-[#fffdf8] px-2 py-2 text-[10px] text-[#66635b]">
                {element.id}
              </code>
            </InspectorField>
            <InspectorField label="Name">
              <input
                className="inspector-input"
                defaultValue={element.name}
                onBlur={(event) => {
                  const name = event.currentTarget.value.trim();
                  if (name && name !== element.name) updateElement({ name });
                }}
              />
            </InspectorField>
            <InspectorField label="Description">
              <textarea
                className="inspector-input min-h-24 resize-y"
                defaultValue={element.description ?? ""}
                onBlur={(event) =>
                  updateElement({ description: event.currentTarget.value.trim() })
                }
              />
            </InspectorField>
            <InspectorField label="Responsibilities · one per line">
              <textarea
                className="inspector-input min-h-28 resize-y"
                defaultValue={(element.responsibilities ?? []).join("\n")}
                placeholder="Accepts orders\nValidates inventory"
                onBlur={(event) =>
                  updateElement({
                    responsibilities: event.currentTarget.value
                      .split("\n")
                      .map((responsibility) => responsibility.trim())
                      .filter((responsibility) => responsibility.length > 0),
                  })
                }
              />
            </InspectorField>
            <div className="border-t border-[#d3cfc4] pt-4 font-mono text-[9px] uppercase tracking-[0.13em] text-[#77736b]">
              {element.kind.replace("-", " ")}
              {element.kind === "container" ? ` / ${element.containerType}` : ""}
            </div>
          </div>
        ) : relationship ? (
          <div
            key={relationship.id}
            className="space-y-5"
            data-testid="relationship-inspector"
          >
            <InspectorField label="Stable ID">
              <code className="block break-all border border-[#d3cfc4] bg-[#fffdf8] px-2 py-2 text-[10px] text-[#66635b]">
                {relationship.id}
              </code>
            </InspectorField>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 font-mono text-[9px] text-[#66635b]">
              <span className="truncate">{relationship.sourceId}</span>
              <span aria-hidden>→</span>
              <span className="truncate text-right">{relationship.destinationId}</span>
            </div>
            <InspectorField label="Description">
              <textarea
                className="inspector-input min-h-24 resize-y"
                defaultValue={relationship.description}
                onBlur={(event) => {
                  const description = event.currentTarget.value.trim();
                  if (description) updateRelationship({ description });
                }}
              />
            </InspectorField>
            <InspectorField label="Technology">
              <input
                className="inspector-input"
                defaultValue={relationship.technology ?? ""}
                placeholder="HTTPS / JSON"
                onBlur={(event) =>
                  updateRelationship({
                    technology: event.currentTarget.value.trim() || undefined,
                  })
                }
              />
            </InspectorField>
          </div>
        ) : (
          <div className="space-y-7">
            <p className="font-serif text-[17px] leading-relaxed text-[#4d4d46]">
              Select a semantic element or relationship to edit its architecture
              properties. Pencil marks and review notes remain annotations.
            </p>
            <form onSubmit={submitNote} className="space-y-3">
              <InspectorField label="Add review note">
                <textarea
                  className="inspector-input min-h-24 resize-y"
                  value={note}
                  onChange={(event) => setNote(event.currentTarget.value)}
                  placeholder="Flag an assumption or requested change…"
                />
              </InspectorField>
              <button
                type="submit"
                disabled={!note.trim()}
                className="w-full bg-[#173f5f] px-3 py-2.5 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-white disabled:opacity-35"
              >
                Pin annotation
              </button>
            </form>
            {document ? (
              <dl className="grid grid-cols-2 gap-px bg-[#c9c5b9] border border-[#c9c5b9]">
                <Metric label="Elements" value={document.elements.length} />
                <Metric label="Relations" value={document.relationships.length} />
                <Metric label="Views" value={document.views.length} />
                <Metric label="Notes" value={document.annotations.length} />
              </dl>
            ) : null}
          </div>
        )}
      </div>
    </aside>
  );
}

function InspectorField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-[#67655e]">
        {label}
      </span>
      {children}
    </label>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-[#fffdf8] p-3">
      <dt className="font-mono text-[8px] uppercase tracking-[0.14em] text-[#77736b]">
        {label}
      </dt>
      <dd className="mt-1 font-serif text-2xl text-[#242520]">{value}</dd>
    </div>
  );
}

export default function SemanticWorkbench() {
  const document = useSemanticDesignStore((state) => state.document);
  const currentRevisionId = useSemanticDesignStore(
    (state) => state.currentRevisionId,
  );
  const activeViewId = useSemanticDesignStore((state) => state.activeViewId);
  const mode = useSemanticDesignStore((state) => state.mode);
  const status = useSemanticDesignStore((state) => state.status);
  const message = useSemanticDesignStore((state) => state.message);
  const issues = useSemanticDesignStore((state) => state.issues);
  const scale = useSemanticDesignStore((state) => state.scale);
  const selectedElementId = useSemanticDesignStore(
    (state) => state.selectedElementId,
  );
  const clipboardElement = useSemanticDesignStore(
    (state) => state.clipboardElement,
  );
  const past = useSemanticDesignStore((state) => state.past);
  const future = useSemanticDesignStore((state) => state.future);
  const loadDesign = useSemanticDesignStore((state) => state.loadDesign);
  const setActiveView = useSemanticDesignStore((state) => state.setActiveView);
  const setMode = useSemanticDesignStore((state) => state.setMode);
  const addElement = useSemanticDesignStore((state) => state.addElement);
  const copyElement = useSemanticDesignStore(
    (state) => state.copySelectedElement,
  );
  const pasteElement = useSemanticDesignStore((state) => state.pasteElement);
  const deleteElement = useSemanticDesignStore(
    (state) => state.deleteSelectedElement,
  );
  const undo = useSemanticDesignStore((state) => state.undo);
  const redo = useSemanticDesignStore((state) => state.redo);
  const saveDraft = useSemanticDesignStore((state) => state.saveDraft);
  const importLegacyBoard = useSemanticDesignStore(
    (state) => state.importLegacyBoard,
  );
  const zoomBy = useSemanticDesignStore((state) => state.zoomBy);
  const resetCamera = useSemanticDesignStore((state) => state.resetCamera);
  const [importMessage, setImportMessage] = useState<string | null>(null);

  useEffect(() => {
    void loadDesign();
  }, [loadDesign]);

  const importBoard = async () => {
    const stored = await boardIndexedDbStorage.getItem(BOARD_STORAGE_KEY);
    if (!stored) {
      setImportMessage("No persisted legacy Board was found in this browser.");
      return;
    }
    setImportMessage(null);
    await importLegacyBoard(stored.state);
  };

  const activeView = document?.views.find((view) => view.id === activeViewId);

  return (
    <main className="flex h-dvh min-h-[680px] flex-col overflow-hidden bg-[#e9e4d9] text-[#242520]">
      <header className="flex h-[74px] shrink-0 items-stretch border-b border-[#aaa69b] bg-[#f8f4eb]">
        <div className="flex w-[290px] shrink-0 items-center border-r border-[#aaa69b] px-6">
          <div>
            <div className="font-mono text-[9px] tracking-[0.2em] text-[#76736b]">
              OPEN WORKBOARD / 02
            </div>
            <h1 className="mt-0.5 font-serif text-[25px] leading-none">
              Design atelier
            </h1>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto px-4">
          {document?.views.map((view, index) => (
            <button
              key={view.id}
              type="button"
              onClick={() => setActiveView(view.id)}
              className={`flex shrink-0 items-center gap-3 border px-4 py-2.5 text-left transition ${
                activeViewId === view.id
                  ? "border-[#173f5f] bg-[#173f5f] text-white"
                  : "border-[#c4c0b6] bg-[#fffdf8] hover:border-[#5d5c56]"
              }`}
            >
              <span className="font-mono text-[9px] opacity-70">0{index + 1}</span>
              <span>
                <span className="block font-serif text-sm leading-none">{view.name}</span>
                <span className="mt-1 block font-mono text-[8px] uppercase tracking-[0.12em] opacity-65">
                  {view.kind.replace("-", " ")}
                </span>
              </span>
            </button>
          ))}
        </div>

        <div className="flex shrink-0 items-center gap-2 border-l border-[#aaa69b] px-4">
          <Link
            href="/"
            className="px-3 py-2 font-mono text-[9px] uppercase tracking-[0.13em] text-[#55534d] underline decoration-[#aaa69b] underline-offset-4"
          >
            Legacy board
          </Link>
          <button
            type="button"
            onClick={() => void saveDraft()}
            disabled={!document || status === "saving"}
            className="border border-[#242520] bg-[#242520] px-4 py-2.5 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-white disabled:opacity-40"
          >
            {status === "saving" ? "Saving…" : "Save draft"}
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-[290px] shrink-0 flex-col border-r border-[#aaa69b] bg-[#ede8de]">
          <div className="border-b border-[#c9c5b9] p-4">
            <div className="mb-3 font-mono text-[9px] uppercase tracking-[0.17em] text-[#716e66]">
              Instruments
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(["select", "connect", "annotate", "pan"] as const).map(
                (workbenchMode) => (
                  <ToolButton
                    key={workbenchMode}
                    label={modeLabel[workbenchMode]}
                    active={mode === workbenchMode}
                    onClick={() => setMode(workbenchMode)}
                  />
                ),
              )}
            </div>
          </div>

          <div className="border-b border-[#c9c5b9] p-4">
            <div className="mb-3 font-mono text-[9px] uppercase tracking-[0.17em] text-[#716e66]">
              Add to {activeView?.kind === "container" ? "container view" : "context"}
            </div>
            {activeView?.kind === "container" ? (
              <div className="grid grid-cols-1 gap-2">
                <ToolButton label="Application" onClick={() => addElement("application")} />
                <ToolButton label="Datastore" onClick={() => addElement("datastore")} />
                <ToolButton label="Message queue" onClick={() => addElement("queue")} />
              </div>
            ) : (
              <ToolButton label="External system" onClick={() => addElement()} />
            )}
          </div>

          <div className="border-b border-[#c9c5b9] p-4">
            <div className="mb-3 font-mono text-[9px] uppercase tracking-[0.17em] text-[#716e66]">
              Edit stack
            </div>
            <div className="grid grid-cols-2 gap-2">
              <ToolButton label="Copy" disabled={!selectedElementId} onClick={copyElement} />
              <ToolButton label="Paste" disabled={!clipboardElement} onClick={pasteElement} />
              <ToolButton label="Undo" disabled={past.length === 0} onClick={undo} />
              <ToolButton label="Redo" disabled={future.length === 0} onClick={redo} />
            </div>
            <button
              type="button"
              disabled={!selectedElementId}
              onClick={deleteElement}
              className="mt-2 w-full border border-[#a43e25] px-3 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-[#a43e25] disabled:opacity-30"
            >
              Delete selected
            </button>
          </div>

          <div className="border-b border-[#c9c5b9] p-4">
            <div className="mb-3 flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.17em] text-[#716e66]">
              <span>Camera</span>
              <span>{Math.round(scale * 100)}%</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <ToolButton label="−" onClick={() => zoomBy(0.85)} />
              <ToolButton label="Reset" onClick={resetCamera} />
              <ToolButton label="+" onClick={() => zoomBy(1.15)} />
            </div>
          </div>

          <div className="mt-auto p-4">
            <button
              type="button"
              onClick={() => void importBoard()}
              className="w-full border border-dashed border-[#77736b] bg-[#f8f4eb] px-3 py-3 text-left font-mono text-[9px] uppercase leading-relaxed tracking-[0.12em] text-[#55534d]"
            >
              Import retained v1 Board → annotation layer
            </button>
            {importMessage ? (
              <p className="mt-2 text-[10px] leading-relaxed text-[#9f3f26]">
                {importMessage}
              </p>
            ) : null}
          </div>
        </aside>

        <section className="relative min-w-0 flex-1 bg-[#fbf8f0]">
          {status === "loading" && !document ? (
            <div className="grid h-full place-items-center font-mono text-[11px] uppercase tracking-[0.18em] text-[#66635b]">
              Loading semantic fixture…
            </div>
          ) : (
            <SemanticCanvas />
          )}
          <div className="pointer-events-none absolute bottom-4 left-4 right-4 flex items-end justify-between gap-4">
            <div
              className={`max-w-[520px] border px-3 py-2 font-mono text-[9px] leading-relaxed shadow-sm ${
                status === "error"
                  ? "border-[#a43e25] bg-[#fff1e8] text-[#8d321e]"
                  : "border-[#c6c2b8] bg-[#fffdf8]/95 text-[#626058]"
              }`}
              role="status"
            >
              {message ?? `${modeLabel[mode]} mode active.`}
            </div>
            <div className="border border-[#c6c2b8] bg-[#fffdf8]/95 px-3 py-2 text-right font-mono text-[8px] leading-relaxed text-[#77736b] shadow-sm">
              <div>{document?.id ?? "NO DESIGN"}</div>
              <div>{currentRevisionId ?? "UNSAVED"}</div>
            </div>
          </div>
        </section>

        <PropertiesPanel />
      </div>

      <details className="group shrink-0 border-t border-[#aaa69b] bg-[#242520] text-[#efebdf]">
        <summary className="cursor-pointer list-none px-5 py-2 font-mono text-[9px] uppercase tracking-[0.17em]">
          Developer document panel · {issues.length} validation issue
          {issues.length === 1 ? "" : "s"} · click to inspect
        </summary>
        <div className="grid max-h-72 grid-cols-2 gap-px overflow-auto bg-[#4b4b45] border-t border-[#4b4b45]">
          <pre className="overflow-auto bg-[#1b1c1a] p-4 text-[10px] leading-relaxed text-[#d7e7dc]">
            {JSON.stringify(document, null, 2)}
          </pre>
          <pre className="overflow-auto bg-[#1b1c1a] p-4 text-[10px] leading-relaxed text-[#f0cfbd]">
            {JSON.stringify(issues, null, 2)}
          </pre>
        </div>
      </details>
    </main>
  );
}
