"use client";

import {
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { LegacyStrokeAnnotation, Point, Rectangle } from "@/domain/design";
import { createSemanticCanvasModel } from "@/semantic/designCanvasAdapter";
import { elementPresentation } from "@/semantic/designCanvasTheme";
import { useSemanticDesignStore } from "@/store/useSemanticDesignStore";

type ElementGesture = {
  pointerId: number;
  elementId: string;
  kind: "move" | "resize";
  origin: Point;
  initial: Rectangle;
};

type SurfaceGesture = {
  pointerId: number;
  origin: Point;
  previous: Point;
  annotationPoints: Point[];
};

const pointString = (points: Point[]) =>
  points.map((point) => `${point.x},${point.y}`).join(" ");

const relationshipLabelPosition = (start: Point, end: Point) => ({
  x: (start.x + end.x) / 2,
  y: (start.y + end.y) / 2,
});

function LegacyAnnotation({ annotation }: { annotation: LegacyStrokeAnnotation }) {
  const { stroke } = annotation;
  const testId = `annotation-${annotation.id}`;
  const width = stroke.bounds.maxX - stroke.bounds.minX;
  const height = stroke.bounds.maxY - stroke.bounds.minY;
  const common = {
    fill: "none",
    stroke: stroke.tool === "eraser" ? "#fbf8f0" : stroke.color,
    strokeWidth: stroke.lineWidth,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  if (stroke.tool === "text") {
    const position = stroke.points[0] ?? {
      x: stroke.bounds.minX,
      y: stroke.bounds.minY,
    };
    return (
      <text
        data-testid={testId}
        x={position.x}
        y={position.y + (stroke.fontSize ?? 20)}
        fill={stroke.color}
        fontFamily="var(--font-geist-sans)"
        fontSize={stroke.fontSize ?? 20}
      >
        {stroke.text ?? ""}
      </text>
    );
  }
  if (stroke.tool === "square") {
    return (
      <rect
        data-testid={testId}
        x={stroke.bounds.minX}
        y={stroke.bounds.minY}
        width={width}
        height={height}
        {...common}
      />
    );
  }
  if (stroke.tool === "circle") {
    return (
      <ellipse
        data-testid={testId}
        cx={stroke.bounds.minX + width / 2}
        cy={stroke.bounds.minY + height / 2}
        rx={width / 2}
        ry={height / 2}
        {...common}
      />
    );
  }
  if (stroke.tool === "rhombus") {
    return (
      <polygon
        data-testid={testId}
        points={pointString([
          { x: stroke.bounds.minX + width / 2, y: stroke.bounds.minY },
          { x: stroke.bounds.maxX, y: stroke.bounds.minY + height / 2 },
          { x: stroke.bounds.minX + width / 2, y: stroke.bounds.maxY },
          { x: stroke.bounds.minX, y: stroke.bounds.minY + height / 2 },
        ])}
        {...common}
      />
    );
  }
  return (
    <polyline
      data-testid={testId}
      points={pointString(stroke.points)}
      markerEnd={stroke.tool === "arrow" ? "url(#semantic-arrow)" : undefined}
      {...common}
    />
  );
}

export default function SemanticCanvas() {
  const document = useSemanticDesignStore((state) => state.document);
  const activeViewId = useSemanticDesignStore((state) => state.activeViewId);
  const selectedElementId = useSemanticDesignStore(
    (state) => state.selectedElementId,
  );
  const selectedRelationshipId = useSemanticDesignStore(
    (state) => state.selectedRelationshipId,
  );
  const connectionSourceId = useSemanticDesignStore(
    (state) => state.connectionSourceId,
  );
  const mode = useSemanticDesignStore((state) => state.mode);
  const scale = useSemanticDesignStore((state) => state.scale);
  const offset = useSemanticDesignStore((state) => state.offset);
  const selectElement = useSemanticDesignStore((state) => state.selectElement);
  const selectRelationship = useSemanticDesignStore(
    (state) => state.selectRelationship,
  );
  const chooseConnectionEndpoint = useSemanticDesignStore(
    (state) => state.chooseConnectionEndpoint,
  );
  const moveElement = useSemanticDesignStore((state) => state.moveElement);
  const addFreehandAnnotation = useSemanticDesignStore(
    (state) => state.addFreehandAnnotation,
  );
  const panBy = useSemanticDesignStore((state) => state.panBy);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [elementGesture, setElementGesture] = useState<ElementGesture | null>(null);
  const [surfaceGesture, setSurfaceGesture] = useState<SurfaceGesture | null>(null);
  const [preview, setPreview] = useState<{ id: string; rectangle: Rectangle } | null>(
    null,
  );

  const model = useMemo(
    () =>
      document && activeViewId
        ? createSemanticCanvasModel(document, activeViewId)
        : null,
    [activeViewId, document],
  );

  const eventPoint = (event: ReactPointerEvent): Point => {
    const surface = surfaceRef.current?.getBoundingClientRect();
    return {
      x: (event.clientX - (surface?.left ?? 0) - offset.x) / scale,
      y: (event.clientY - (surface?.top ?? 0) - offset.y) / scale,
    };
  };

  const startElementGesture = (
    event: ReactPointerEvent<HTMLDivElement>,
    elementId: string,
    rectangle: Rectangle,
    kind: "move" | "resize",
  ) => {
    if (mode === "connect") {
      chooseConnectionEndpoint(elementId);
      return;
    }
    if (mode !== "select") return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    selectElement(elementId);
    setElementGesture({
      pointerId: event.pointerId,
      elementId,
      kind,
      origin: { x: event.clientX, y: event.clientY },
      initial: rectangle,
    });
    setPreview({ id: elementId, rectangle });
  };

  const updateElementGesture = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!elementGesture || elementGesture.pointerId !== event.pointerId) return;
    const dx = (event.clientX - elementGesture.origin.x) / scale;
    const dy = (event.clientY - elementGesture.origin.y) / scale;
    const rectangle =
      elementGesture.kind === "move"
        ? {
            ...elementGesture.initial,
            x: Math.max(0, elementGesture.initial.x + dx),
            y: Math.max(0, elementGesture.initial.y + dy),
          }
        : {
            ...elementGesture.initial,
            width: Math.max(150, elementGesture.initial.width + dx),
            height: Math.max(96, elementGesture.initial.height + dy),
          };
    setPreview({ id: elementGesture.elementId, rectangle });
  };

  const finishElementGesture = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!elementGesture || elementGesture.pointerId !== event.pointerId) return;
    if (preview) moveElement(preview.id, preview.rectangle);
    setElementGesture(null);
    setPreview(null);
  };

  const startSurfaceGesture = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (mode !== "annotate" && mode !== "pan") {
      selectElement(null);
      selectRelationship(null);
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    const screenPoint = { x: event.clientX, y: event.clientY };
    const worldPoint = eventPoint(event);
    setSurfaceGesture({
      pointerId: event.pointerId,
      origin: screenPoint,
      previous: screenPoint,
      annotationPoints: mode === "annotate" ? [worldPoint] : [],
    });
  };

  const updateSurfaceGesture = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!surfaceGesture || surfaceGesture.pointerId !== event.pointerId) return;
    if (mode === "pan") {
      panBy({
        x: event.clientX - surfaceGesture.previous.x,
        y: event.clientY - surfaceGesture.previous.y,
      });
      setSurfaceGesture({
        ...surfaceGesture,
        previous: { x: event.clientX, y: event.clientY },
      });
      return;
    }
    if (mode === "annotate") {
      setSurfaceGesture({
        ...surfaceGesture,
        annotationPoints: [...surfaceGesture.annotationPoints, eventPoint(event)],
      });
    }
  };

  const finishSurfaceGesture = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!surfaceGesture || surfaceGesture.pointerId !== event.pointerId) return;
    if (mode === "annotate") {
      addFreehandAnnotation(surfaceGesture.annotationPoints);
    }
    setSurfaceGesture(null);
  };

  if (!model) {
    return (
      <div className="grid h-full place-items-center text-sm text-[#65635e]">
        No active view is available.
      </div>
    );
  }

  return (
    <div
      ref={surfaceRef}
      className={`semantic-canvas relative h-full min-h-[560px] overflow-hidden ${
        mode === "pan"
          ? "cursor-grab active:cursor-grabbing"
          : mode === "annotate"
            ? "cursor-crosshair"
            : "cursor-default"
      }`}
      data-testid="semantic-canvas"
      onPointerDown={startSurfaceGesture}
      onPointerMove={updateSurfaceGesture}
      onPointerUp={finishSurfaceGesture}
      onPointerCancel={finishSurfaceGesture}
    >
      <div
        className="absolute left-0 top-0 origin-top-left transition-transform duration-75"
        style={{
          width: model.width,
          height: model.height,
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
        }}
      >
        <svg
          className="pointer-events-none absolute inset-0 overflow-visible"
          width={model.width}
          height={model.height}
          aria-label={`${model.view.name} relationships and annotations`}
        >
          <defs>
            <marker
              id="semantic-arrow"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#454641" />
            </marker>
          </defs>

          {model.boundaries.map(({ boundary, rectangle }) => (
            <g key={boundary.id}>
              <rect
                x={rectangle.x}
                y={rectangle.y}
                width={rectangle.width}
                height={rectangle.height}
                rx="12"
                fill="rgba(23,63,95,0.035)"
                stroke="#748b9a"
                strokeDasharray="8 7"
                strokeWidth="1.5"
              />
              <text
                x={rectangle.x + 18}
                y={rectangle.y + 27}
                fill="#173f5f"
                fontFamily="var(--font-geist-mono)"
                fontSize="11"
                letterSpacing="1.4"
              >
                {boundary.name.toUpperCase()} · TRUST BOUNDARY
              </text>
            </g>
          ))}

          {model.relationships.map(({ relationship, start, end }) => {
            const label = relationshipLabelPosition(start, end);
            const selected = relationship.id === selectedRelationshipId;
            return (
              <g key={relationship.id}>
                <path
                  d={`M ${start.x} ${start.y} L ${end.x} ${end.y}`}
                  fill="none"
                  stroke={selected ? "#e14b2a" : "#454641"}
                  strokeWidth={selected ? 3 : 2}
                  markerEnd="url(#semantic-arrow)"
                />
                <foreignObject
                  x={label.x - 92}
                  y={label.y - 27}
                  width="184"
                  height="54"
                  className="pointer-events-auto overflow-visible"
                >
                  <button
                    type="button"
                    className={`mx-auto block max-w-[180px] border px-2 py-1 text-center font-mono text-[10px] leading-tight shadow-sm transition ${
                      selected
                        ? "border-[#e14b2a] bg-[#fff4e8] text-[#8e321d]"
                        : "border-[#c7c3b8] bg-[#fffdf8] text-[#4b4a45] hover:border-[#5c5a52]"
                    }`}
                    data-testid={`relationship-${relationship.id}`}
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={() => selectRelationship(relationship.id)}
                  >
                    {relationship.description}
                    {relationship.technology ? ` · ${relationship.technology}` : ""}
                  </button>
                </foreignObject>
              </g>
            );
          })}

          {model.annotations.map((annotation) =>
            annotation.kind === "text" ? (
              <g key={annotation.id}>
                <path
                  d={`M ${annotation.position.x - 12} ${annotation.position.y - 10} h 4 v 36 h -4`}
                  stroke="#e14b2a"
                  strokeWidth="3"
                  fill="none"
                />
                <text
                  data-testid={`annotation-${annotation.id}`}
                  x={annotation.position.x}
                  y={annotation.position.y}
                  fill="#8e321d"
                  fontFamily="var(--font-geist-sans)"
                  fontSize="13"
                  fontStyle="italic"
                >
                  {annotation.text}
                </text>
              </g>
            ) : (
              <LegacyAnnotation
                key={annotation.id}
                annotation={annotation}
              />
            ),
          )}

          {mode === "annotate" && surfaceGesture?.annotationPoints.length ? (
            <polyline
              points={pointString(surfaceGesture.annotationPoints)}
              fill="none"
              stroke="#e14b2a"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}
        </svg>

        {model.elements.map(({ element, rectangle, tone, eyebrow }) => {
          const visibleRectangle =
            preview?.id === element.id ? preview.rectangle : rectangle;
          const presentation = elementPresentation(tone);
          const selected = selectedElementId === element.id;
          const connectionSource = connectionSourceId === element.id;
          return (
            <div
              key={element.id}
              role="button"
              tabIndex={0}
              className={`group absolute touch-none select-none border-2 p-4 text-left shadow-[4px_4px_0_rgba(30,31,29,0.13)] transition-[box-shadow,filter] ${
                mode === "connect" ? "cursor-crosshair" : "cursor-move"
              } ${selected ? "z-20 ring-4 ring-[#e14b2a]/25" : "z-10"}`}
              style={{
                left: visibleRectangle.x,
                top: visibleRectangle.y,
                width: visibleRectangle.width,
                height: visibleRectangle.height,
                borderColor: connectionSource ? "#e14b2a" : presentation.border,
                background: presentation.background,
                color: presentation.accent,
              }}
              data-element-id={element.id}
              data-testid={`element-${element.id}`}
              onPointerDown={(event) =>
                startElementGesture(event, element.id, visibleRectangle, "move")
              }
              onPointerMove={updateElementGesture}
              onPointerUp={finishElementGesture}
              onPointerCancel={finishElementGesture}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  if (mode === "connect") chooseConnectionEndpoint(element.id);
                  else selectElement(element.id);
                }
              }}
            >
              <div className="mb-3 flex items-center justify-between gap-2 font-mono text-[9px] tracking-[0.16em]">
                <span>{eyebrow.toUpperCase()}</span>
                <span
                  className="border px-1.5 py-0.5"
                  style={{ borderColor: presentation.border }}
                >
                  {presentation.badge}
                </span>
              </div>
              <div className="font-serif text-[19px] font-semibold leading-tight text-[#20211f]">
                {element.name}
              </div>
              {element.description ? (
                <div className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-[#55564f]">
                  {element.description}
                </div>
              ) : null}
              <div className="absolute bottom-2 left-4 font-mono text-[8px] text-[#77776f] opacity-70">
                {element.id}
              </div>
              {mode === "select" && selected ? (
                <div
                  aria-label="Resize element"
                  className="absolute -bottom-2 -right-2 h-4 w-4 cursor-nwse-resize border-2 border-[#fffdf8] bg-[#e14b2a]"
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    startElementGesture(
                      event,
                      element.id,
                      visibleRectangle,
                      "resize",
                    );
                  }}
                  onPointerMove={updateElementGesture}
                  onPointerUp={finishElementGesture}
                  onPointerCancel={finishElementGesture}
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
