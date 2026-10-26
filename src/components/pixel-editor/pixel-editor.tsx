"use client";

import {
  Eraser,
  PaintBucket,
  Pencil,
  Pipette,
  Redo2,
  Undo2,
  Upload,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Button, IconButton } from "@/components/ui/button";
import {
  commit,
  cssColor,
  emptyImage,
  floodFill,
  getPixel,
  ICON_SIZE,
  parseHexColor,
  pushRecentColor,
  redo,
  rgbaHex,
  rgbHex,
  setPixel,
  startHistory,
  TRANSPARENT,
  undo,
  type History,
  type PixelImage,
  type Rgba,
} from "@/domain/pixel-image";
import { useT } from "@/i18n/client";
import { decodeIcon } from "./icon-io";

type Tool = "pencil" | "eraser" | "fill" | "eyedropper";

const RECENT_KEY = "mf-recent-colors";
const MIN_CELL = 12;
const MAX_CELL = 48;
const START_COLOR: Rgba = [0, 0, 0, 255];

function readRecent(): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(value)
      ? value.filter(
          (c): c is string => typeof c === "string" && !!parseHexColor(c),
        )
      : [];
  } catch {
    return [];
  }
}

function writeRecent(colors: string[]) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(colors));
  } catch {
    // Storage may be unavailable (private mode); recent colors are a convenience.
  }
}

/**
 * 16×16 pixel editor for entry icons (spec 04): pencil, eraser, fill,
 * eyedropper, color with opacity and recent colors, undo/redo, zoom by
 * buttons or pinch, PNG import. Works with mouse, touch and pen.
 */
export function PixelEditor({
  initial,
  onDone,
  onCancel,
}: {
  initial: PixelImage | null;
  onDone: (image: PixelImage) => void;
  onCancel: () => void;
}) {
  const t = useT();
  const colorId = useId();
  const alphaId = useId();
  const fileId = useId();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [history, setHistoryState] = useState<History>(() =>
    startHistory(initial ?? emptyImage()),
  );
  // The image while a stroke is drawn; committed as one undo step on release.
  const [stroke, setStrokeState] = useState<PixelImage | null>(null);
  // Refs mirror the state so pointer events that arrive before React
  // re-renders (fast taps and drags) see the latest values.
  const historyRef = useRef(history);
  const strokeRef = useRef<PixelImage | null>(null);
  const setHistory = (update: (h: History) => History) => {
    historyRef.current = update(historyRef.current);
    setHistoryState(historyRef.current);
  };
  const setStroke = (value: PixelImage | null) => {
    strokeRef.current = value;
    setStrokeState(value);
  };
  const [tool, setTool] = useState<Tool>("pencil");
  const [color, setColor] = useState<Rgba>(START_COLOR);
  const [recent, setRecent] = useState<string[]>([]);
  const [cell, setCell] = useState(20);
  const [importError, setImportError] = useState(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{
    distance: number;
    cell: number;
    mid: { x: number; y: number };
  } | null>(null);

  const image = stroke ?? history.present;

  useEffect(() => {
    // Recent colors live in localStorage, which only exists in the browser.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRecent(readRecent());
  }, []);

  useEffect(() => {
    const context = canvasRef.current?.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, ICON_SIZE, ICON_SIZE);
    for (let y = 0; y < ICON_SIZE; y++) {
      for (let x = 0; x < ICON_SIZE; x++) {
        const pixel = getPixel(image, x, y);
        if (pixel[3] === 0) continue;
        context.fillStyle = cssColor(pixel);
        context.fillRect(x, y, 1, 1);
      }
    }
  }, [image]);

  const remember = (used: Rgba) => {
    if (used[3] === 0) return;
    const next = pushRecentColor(recent, used);
    setRecent(next);
    writeRecent(next);
  };

  const cellAt = (event: { clientX: number; clientY: number }) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: Math.floor(((event.clientX - rect.left) / rect.width) * ICON_SIZE),
      y: Math.floor(((event.clientY - rect.top) / rect.height) * ICON_SIZE),
    };
  };

  function paint(event: ReactPointerEvent, base: PixelImage): PixelImage {
    const { x, y } = cellAt(event);
    return setPixel(base, x, y, tool === "eraser" ? TRANSPARENT : color);
  }

  function onPointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    try {
      // Keeps the stroke when the pointer leaves the canvas.
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Not every pointer can be captured (e.g. synthetic ones); drawing still works.
    }
    pointers.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    if (pointers.current.size === 2) {
      // Second finger: pinch zoom and pan instead of drawing.
      setStroke(null);
      const [a, b] = [...pointers.current.values()] as [
        { x: number; y: number },
        { x: number; y: number },
      ];
      pinch.current = {
        distance: Math.hypot(a.x - b.x, a.y - b.y),
        cell,
        mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      };
      return;
    }
    if (pointers.current.size > 2) return;
    const { x, y } = cellAt(event);
    if (tool === "eyedropper") {
      const picked = getPixel(historyRef.current.present, x, y);
      if (picked[3] > 0) setColor(picked);
      setTool("pencil");
      return;
    }
    if (tool === "fill") {
      setHistory((h) => commit(h, floodFill(h.present, x, y, color)));
      remember(color);
      return;
    }
    setStroke(paint(event, historyRef.current.present));
  }

  function onPointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    if (pinch.current && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()] as [
        { x: number; y: number },
        { x: number; y: number },
      ];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const next = Math.round(
        pinch.current.cell * (distance / pinch.current.distance),
      );
      setCell(Math.min(MAX_CELL, Math.max(MIN_CELL, next)));
      scrollRef.current?.scrollBy(
        pinch.current.mid.x - mid.x,
        pinch.current.mid.y - mid.y,
      );
      pinch.current = { ...pinch.current, mid };
      return;
    }
    if (strokeRef.current) setStroke(paint(event, strokeRef.current));
  }

  function onPointerUp(event: ReactPointerEvent<HTMLCanvasElement>) {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    const finished = strokeRef.current;
    if (finished) {
      setHistory((h) => commit(h, finished));
      if (tool === "pencil") remember(color);
      setStroke(null);
    }
  }

  async function importPng(file: File | undefined) {
    if (!file) return;
    setImportError(false);
    try {
      const imported = await decodeIcon(file);
      setHistory((h) => commit(h, imported));
    } catch {
      setImportError(true);
    }
  }

  const tools: { id: Tool; label: string; icon: typeof Pencil }[] = [
    { id: "pencil", label: t("pixel.pencil"), icon: Pencil },
    { id: "eraser", label: t("pixel.eraser"), icon: Eraser },
    { id: "fill", label: t("pixel.fill"), icon: PaintBucket },
    { id: "eyedropper", label: t("pixel.eyedropper"), icon: Pipette },
  ];
  const size = cell * ICON_SIZE;

  return (
    <div className="flex flex-col gap-3">
      <div
        className="flex flex-wrap items-center gap-1"
        role="toolbar"
        aria-label={t("pixel.tools")}
      >
        {tools.map(({ id, label, icon: Icon }) => (
          <IconButton
            key={id}
            label={label}
            aria-pressed={tool === id}
            onClick={() => setTool(id)}
            className="aria-pressed:bg-accent/13 aria-pressed:ring-2 aria-pressed:ring-accent"
          >
            <Icon className="size-5" aria-hidden />
          </IconButton>
        ))}
        <span className="mx-1 h-8 w-px bg-border" aria-hidden />
        <IconButton
          label={t("pixel.undo")}
          onClick={() => setHistory(undo)}
          disabled={history.past.length === 0}
        >
          <Undo2 className="size-5" aria-hidden />
        </IconButton>
        <IconButton
          label={t("pixel.redo")}
          onClick={() => setHistory(redo)}
          disabled={history.future.length === 0}
        >
          <Redo2 className="size-5" aria-hidden />
        </IconButton>
        <IconButton
          label={t("pixel.zoomOut")}
          onClick={() => setCell((c) => Math.max(MIN_CELL, c - 4))}
          disabled={cell <= MIN_CELL}
        >
          <ZoomOut className="size-5" aria-hidden />
        </IconButton>
        <IconButton
          label={t("pixel.zoomIn")}
          onClick={() => setCell((c) => Math.min(MAX_CELL, c + 4))}
          disabled={cell >= MAX_CELL}
        >
          <ZoomIn className="size-5" aria-hidden />
        </IconButton>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor={colorId} className="text-sm font-medium">
            {t("pixel.color")}
          </label>
          <input
            id={colorId}
            type="color"
            value={rgbHex(color)}
            onChange={(e) => {
              const parsed = parseHexColor(e.target.value);
              if (parsed) setColor([parsed[0], parsed[1], parsed[2], color[3]]);
              if (tool === "eraser" || tool === "eyedropper") setTool("pencil");
            }}
            className="h-11 w-16 cursor-pointer rounded-md border border-border bg-bg"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={alphaId} className="text-sm font-medium">
            {t("pixel.alphaValue", {
              value: Math.round((color[3] / 255) * 100),
            })}
          </label>
          <input
            id={alphaId}
            type="range"
            min={1}
            max={255}
            value={color[3]}
            onChange={(e) =>
              setColor([color[0], color[1], color[2], Number(e.target.value)])
            }
            className="h-11 w-40 accent-accent"
          />
        </div>
      </div>

      {recent.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium">{t("pixel.recent")}</span>
          <div className="flex flex-wrap gap-1">
            {recent.map((hex) => {
              const value = parseHexColor(hex)!;
              return (
                <button
                  key={hex}
                  type="button"
                  aria-label={t("pixel.useColor", { color: hex })}
                  title={hex}
                  onClick={() => {
                    setColor(value);
                    setTool("pencil");
                  }}
                  className={`size-11 rounded-md border border-border ${rgbaHex(color) === hex ? "ring-2 ring-accent" : ""}`}
                  // The swatch shows user data: the color itself.
                  style={{ background: cssColor(value) }}
                />
              );
            })}
          </div>
        </div>
      )}

      <div
        ref={scrollRef}
        className="max-h-[70dvh] max-w-full overflow-auto rounded-md border border-border"
      >
        <div
          className="relative"
          style={{
            width: size,
            height: size,
            // Checkerboard and grid from theme tokens: transparency and pixel borders.
            background: `linear-gradient(var(--border) 1px, transparent 1px) 0 0 / ${cell}px ${cell}px, linear-gradient(90deg, var(--border) 1px, transparent 1px) 0 0 / ${cell}px ${cell}px, repeating-conic-gradient(var(--slot) 0 25%, var(--surface) 0 50%) 0 0 / ${cell * 2}px ${cell * 2}px`,
          }}
        >
          <canvas
            ref={canvasRef}
            width={ICON_SIZE}
            height={ICON_SIZE}
            role="img"
            aria-label={t("pixel.canvas")}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            className="absolute inset-0 cursor-crosshair touch-none [image-rendering:pixelated]"
            style={{ width: size, height: size }}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <label
            htmlFor={fileId}
            className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm font-medium text-text hover:bg-accent/13"
          >
            <Upload className="size-4" aria-hidden />
            {t("pixel.import")}
          </label>
          <input
            id={fileId}
            type="file"
            accept="image/png"
            className="sr-only"
            onChange={(e) => {
              void importPng(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          {importError && (
            <p className="text-sm text-danger">{t("pixel.importFailed")}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button onClick={onCancel}>{t("pixel.cancel")}</Button>
          <Button variant="primary" onClick={() => onDone(history.present)}>
            {t("pixel.done")}
          </Button>
        </div>
      </div>
    </div>
  );
}
