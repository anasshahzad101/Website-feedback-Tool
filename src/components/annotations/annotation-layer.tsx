"use client";

import { useRef, useCallback, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { CommentStatus, AnnotationType } from "@prisma/client";
import { cn } from "@/lib/utils";

export interface NewAnnotation {
  id: string;
  annotationType: "PIN";
  x: number;
  y: number;
  xPercent: number;
  yPercent: number;
  color: string;
}

export interface Annotation {
  id: string;
  annotationType: AnnotationType;
  x: number;
  y: number;
  xPercent: number;
  yPercent: number;
  color: string;
  commentThreadId?: string | null;
  targetTimestampMs?: number | null;
  commentThread?: { id: string; status: CommentStatus } | null;
  width?: number | null;
  height?: number | null;
  widthPercent?: number | null;
  heightPercent?: number | null;
  pointsJson?: string | null;
  // Optional screenshot context for this annotation (used in comment sidebar)
  screenshotContextPath?: string | null;
  /** 0–1: pin X/Y within the context crop image (when screenshotContextPath is a pin crop). */
  pinInCropX?: number | null;
  pinInCropY?: number | null;
  /** JSON blob with viewport / DOM-anchor metadata (markup.io live-mode pins). */
  viewportMetaJson?: string | null;
}

interface AnnotationLayerProps {
  annotations: Annotation[];
  selectedAnnotationId: string | null;
  onAnnotationCreated: (annotation: NewAnnotation) => void;
  onAnnotationSelected: (annotationId: string | null) => void;
  zoom: number;
  contentWidth: number;
  contentHeight: number;
  /** When false, the layer does not capture pointer events (e.g. browse mode overlay). */
  interactive?: boolean;
  className?: string;
}

const statusColors: Record<CommentStatus, string> = {
  OPEN: "#3b82f6",
  IN_PROGRESS: "#f59e0b",
  RESOLVED: "#22c55e",
  CLOSED: "#64748b",
  IGNORED: "#94a3b8",
};

export function AnnotationLayer({
  annotations,
  selectedAnnotationId,
  onAnnotationCreated,
  onAnnotationSelected,
  zoom,
  contentWidth,
  contentHeight,
  interactive = true,
  className,
}: AnnotationLayerProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  const svgWidth = contentWidth > 0 ? contentWidth : 1024;
  const svgHeight = contentHeight > 0 ? contentHeight : 768;

  const getSVGPoint = useCallback((e: React.MouseEvent) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const rect = svgRef.current.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / zoom,
      y: (e.clientY - rect.top) / zoom,
    };
  }, [zoom]);

  const handleSVGClick = useCallback((e: React.MouseEvent) => {
    // Only create a pin if clicking the SVG background (not an existing pin)
    if ((e.target as SVGElement).closest("[data-annotation-pin]")) return;

    const point = getSVGPoint(e);
    const xPercent = parseFloat((point.x / svgWidth).toFixed(6));
    const yPercent = parseFloat((point.y / svgHeight).toFixed(6));

    const newAnnotation: NewAnnotation = {
      id: uuidv4(),
      annotationType: "PIN",
      x: Math.round(point.x),
      y: Math.round(point.y),
      xPercent,
      yPercent,
      color: "#3b82f6",
    };

    onAnnotationCreated(newAnnotation);
    // Do not call onAnnotationSelected(null) here — the parent sets selection on the new pin;
    // clearing it made the pin look unselected right after place (felt like a failed click).
  }, [getSVGPoint, svgWidth, svgHeight, onAnnotationCreated]);

  const handlePinClick = useCallback((e: React.MouseEvent, annotationId: string) => {
    e.stopPropagation();
    onAnnotationSelected(annotationId === selectedAnnotationId ? null : annotationId);
  }, [selectedAnnotationId, onAnnotationSelected]);

  return (
    <svg
      ref={svgRef}
      className={cn("absolute inset-0", className)}
      style={{
        width: svgWidth,
        height: svgHeight,
        cursor: interactive ? "crosshair" : "default",
        pointerEvents: interactive ? "all" : "none",
      }}
      onClick={interactive ? handleSVGClick : undefined}
    >
      {annotations.map((annotation, index) => {
        const pinNumber = index + 1;
        const isSelected = selectedAnnotationId === annotation.id;
        const isHovered = hovered === annotation.id;
        const color = annotation.commentThread
          ? statusColors[annotation.commentThread.status]
          : annotation.color || "#3b82f6";

        const cx = annotation.x;
        const cy = annotation.y;
        const r = isSelected || isHovered ? 14 : 12;

        return (
          <g
            key={annotation.id}
            data-annotation-pin="true"
            onClick={(e) => handlePinClick(e, annotation.id)}
            onMouseEnter={() => setHovered(annotation.id)}
            onMouseLeave={() => setHovered(null)}
            style={{ cursor: "pointer" }}
          >
            {/* Pulse ring when selected */}
            {isSelected && (
              <circle
                cx={cx}
                cy={cy}
                r={r + 8}
                fill="none"
                stroke={color}
                strokeWidth={2}
                opacity={0.4}
                strokeDasharray="4 3"
              >
                <animate
                  attributeName="r"
                  values={`${r + 4};${r + 12};${r + 4}`}
                  dur="1.5s"
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  values="0.5;0.1;0.5"
                  dur="1.5s"
                  repeatCount="indefinite"
                />
              </circle>
            )}

            {/* Drop shadow */}
            <filter id={`shadow-${annotation.id}`} x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.3" />
            </filter>

            {/* Pin circle */}
            <circle
              cx={cx}
              cy={cy}
              r={r}
              fill={color}
              stroke="white"
              strokeWidth={2.5}
              filter={`url(#shadow-${annotation.id})`}
            />

            {/* Pin number */}
            <text
              x={cx}
              y={cy + 1}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="white"
              fontSize={pinNumber > 9 ? 9 : 11}
              fontWeight="700"
              fontFamily="system-ui, sans-serif"
              style={{ pointerEvents: "none", userSelect: "none" }}
            >
              {pinNumber}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
