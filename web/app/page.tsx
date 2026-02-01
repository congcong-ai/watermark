"use client";
import React, { useCallback, useMemo, useRef, useState } from "react";
import JSZip from "jszip";

type InputItem = { file: File; path: string };

type Position = "tile" | "center" | "top-left" | "bottom-right";

type Options = {
  text: string;
  color: string;
  opacity: number;
  fontSize: number;
  position: Position;
  rotate: number;
};

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

async function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

function extOf(name: string) {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

function mimeOfExt(ext: string) {
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "webp") return "image/webp";
  if (ext === "bmp") return "image/bmp";
  return "image/png";
}

async function addWatermark(img: HTMLImageElement, opts: Options, outputExt: string): Promise<Blob> {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas not supported");
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.globalAlpha = Math.min(Math.max(opts.opacity, 0), 1);
  const baseSize = opts.fontSize > 0 ? opts.fontSize : Math.max(12, Math.round(canvas.width * 0.05));
  ctx.font = `${baseSize}px sans-serif`;
  ctx.fillStyle = opts.color;
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  const text = opts.text || "Watermark";
  const rad = (opts.rotate * Math.PI) / 180;
  if (opts.position === "center") {
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(rad);
    ctx.fillText(text, 0, 0);
  } else if (opts.position === "top-left") {
    ctx.translate(0, 0);
    ctx.rotate(rad);
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(text, 8, 8);
  } else if (opts.position === "bottom-right") {
    ctx.translate(canvas.width, canvas.height);
    ctx.rotate(rad);
    ctx.textAlign = "right";
    ctx.textBaseline = "bottom";
    ctx.fillText(text, -8, -8);
  } else {
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(rad);
    ctx.translate(-canvas.width / 2, -canvas.height / 2);
    const metrics = ctx.measureText(text);
    const w = Math.max(metrics.width, baseSize * text.length * 0.6);
    const h = baseSize * 1.5;
    const stepX = w + 80;
    const stepY = h + 80;
    for (let y = -stepY; y < canvas.height + stepY; y += stepY) {
      for (let x = -stepX; x < canvas.width + stepX; x += stepX) {
        ctx.fillText(text, x + w / 2, y + h / 2);
      }
    }
  }
  ctx.restore();
  const mime = mimeOfExt(outputExt);
  const quality = mime === "image/jpeg" ? 0.92 : undefined;
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b as Blob), mime, quality));
}

async function readAllEntries(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  const entries: FileSystemEntry[] = [];
  while (true) {
    const chunk: FileSystemEntry[] = await new Promise((res, rej) => reader.readEntries(res, rej));
    if (!chunk.length) break;
    entries.push(...chunk);
  }
  return entries;
}

async function traverse(entry: FileSystemEntry): Promise<InputItem[]> {
  if (entry.isFile) {
    const f = await new Promise<File>((res, rej) => (entry as FileSystemFileEntry).file(res, rej));
    const path = (entry.fullPath || f.webkitRelativePath || f.name).replace(/^\//, "");
    return [{ file: f, path }];
  }
  if (entry.isDirectory) {
    const dir = entry as FileSystemDirectoryEntry;
    const reader = dir.createReader();
    const entries = await readAllEntries(reader);
    const results = await Promise.all(entries.map(traverse));
    return results.flat();
  }
  return [];
}

function uniqueByPath(items: InputItem[]) {
  const map = new Map<string, InputItem>();
  for (const it of items) {
    if (!map.has(it.path)) map.set(it.path, it);
  }
  return Array.from(map.values());
}

export default function Page() {
  const appTitle = process.env.NEXT_PUBLIC_APP_TITLE || "给图片加水印";
  const defaultText = process.env.NEXT_PUBLIC_DEFAULT_WATERMARK_TEXT || "仅用于学习测试";
  const defaultColor = process.env.NEXT_PUBLIC_DEFAULT_COLOR || "#ffffff";
  const defaultOpacity = Math.min(Math.max(Number(process.env.NEXT_PUBLIC_DEFAULT_OPACITY ?? "0.25"), 0), 1);
  const defaultFontSize = Number(process.env.NEXT_PUBLIC_DEFAULT_FONT_SIZE ?? "24");
  const rawPos = (process.env.NEXT_PUBLIC_DEFAULT_POSITION as Position | undefined);
  const defaultPosition: Position = rawPos === "center" || rawPos === "top-left" || rawPos === "bottom-right" || rawPos === "tile" ? rawPos : "tile";
  const defaultRotate = Number(process.env.NEXT_PUBLIC_DEFAULT_ROTATE ?? "-30");
  const [items, setItems] = useState<InputItem[]>([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [text, setText] = useState(defaultText);
  const [color, setColor] = useState(defaultColor);
  const [opacity, setOpacity] = useState(defaultOpacity);
  const [fontSize, setFontSize] = useState(defaultFontSize);
  const [position, setPosition] = useState<Position>(defaultPosition);
  const [rotate, setRotate] = useState(defaultRotate);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const dirRef = useRef<HTMLInputElement | null>(null);

  const totalSize = useMemo(() => items.reduce((s, i) => s + i.file.size, 0), [items]);

  const addFiles = useCallback((files: FileList | File[]) => {
    const next: InputItem[] = [];
    Array.from(files).forEach((f) => {
      const p = (f as any).webkitRelativePath || f.name;
      next.push({ file: f, path: String(p) });
    });
    setItems((prev) => uniqueByPath([...prev, ...next]));
  }, []);

  const onDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const dt = e.dataTransfer;
    const list: InputItem[] = [];
    if (dt.items && dt.items.length) {
      const tasks: Promise<InputItem[]>[] = [];
      for (const it of Array.from(dt.items)) {
        const entry = (it as DataTransferItem).webkitGetAsEntry?.();
        if (entry) tasks.push(traverse(entry));
      }
      if (tasks.length) {
        const all = (await Promise.all(tasks)).flat();
        list.push(...all);
      }
    }
    if (!list.length && dt.files && dt.files.length) {
      Array.from(dt.files).forEach((f) => {
        const p = (f as any).webkitRelativePath || f.name;
        list.push({ file: f, path: String(p) });
      });
    }
    if (list.length) setItems((prev) => uniqueByPath([...prev, ...list]));
  }, []);

  const onSelectFiles = useCallback<React.ChangeEventHandler<HTMLInputElement>>((e) => {
    if (e.target.files?.length) addFiles(e.target.files);
    e.currentTarget.value = "";
  }, [addFiles]);

  const onSelectDir = useCallback<React.ChangeEventHandler<HTMLInputElement>>((e) => {
    if (e.target.files?.length) addFiles(e.target.files);
    e.currentTarget.value = "";
  }, [addFiles]);

  const onProcess = useCallback(async () => {
    if (!items.length || processing) return;
    setProcessing(true);
    setProgress(0);
    try {
      const zip = new JSZip();
      let done = 0;
      for (const it of items) {
        const img = await loadImage(it.file);
        const ext = extOf(it.file.name) || "png";
        const blob = await addWatermark(img, { text, color, opacity, fontSize, position, rotate }, ext);
        const path = `watermarked/${it.path}`;
        zip.file(path, blob);
        done += 1;
        setProgress(Math.round((done / items.length) * 100));
      }
      const out = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
      const a = document.createElement("a");
      const url = URL.createObjectURL(out);
      const ts = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      const name = `watermarked-${ts.getFullYear()}${pad(ts.getMonth() + 1)}${pad(ts.getDate())}-${pad(ts.getHours())}${pad(ts.getMinutes())}${pad(ts.getSeconds())}.zip`;
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setProcessing(false);
    }
  }, [items, processing, text, color, opacity, fontSize, position, rotate]);

  return (
    <main className="mx-auto max-w-screen-xl px-6 lg:px-10 py-20">
      <div className="rounded-3xl border bg-white/90 p-12 md:p-16 text-center shadow-lg backdrop-blur-sm">
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 md:text-5xl">{appTitle}</h1>
        <p className="mx-auto mt-3 max-w-3xl text-lg text-slate-600 md:text-xl">
          给 JPG、PNG 或 GIF 图片加水印，一次为多个图片添加文本水印
        </p>

        <div className="mt-8 flex items-center justify-center gap-3">
          <input ref={inputRef} type="file" multiple accept="image/*" onChange={onSelectFiles} className="hidden" />
          <button
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-8 py-4 text-lg font-medium text-white shadow-lg ring-1 ring-emerald-400/20 hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2"
          >
            选择多张图片
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
              <path d="M12 4a1 1 0 0 1 1 1v6h6a1 1 0 1 1 0 2h-6v6a1 1 0 1 1-2 0v-6H5a1 1 0 1 1 0-2h6V5a1 1 0 0 1 1-1Z" />
            </svg>
          </button>
          <input
            ref={dirRef}
            type="file"
            onChange={onSelectDir}
            className="hidden"
            {...({ webkitdirectory: "", directory: "" } as any)}
          />
          <button
            onClick={() => dirRef.current?.click()}
            title="选择目录"
            className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 shadow-sm ring-1 ring-emerald-100 hover:bg-emerald-100"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
              <path d="M3 6a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v1H3V6Zm0 4h18v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6Z" />
            </svg>
          </button>
          <button
            onClick={() => setItems([])}
            title="清空列表"
            className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-white text-slate-600 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
              <path fillRule="evenodd" d="M6.225 4.811a1 1 0 0 1 1.414 0L12 9.172l4.361-4.361a1 1 0 1 1 1.414 1.414L13.414 10.586l4.361 4.361a1 1 0 0 1-1.414 1.414L12 12l-4.361 4.361a1 1 0 0 1-1.414-1.414l4.361-4.361-4.361-4.361a1 1 0 0 1 0-1.414Z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        <div
          onDragEnter={() => setDragActive(true)}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={onDrop}
          className={`mx-auto mt-8 flex h-64 max-w-4xl items-center justify-center rounded-3xl border-2 border-dashed transition-colors ${
            dragActive ? "border-emerald-400 bg-emerald-50 ring-2 ring-emerald-100" : "border-slate-300 bg-slate-50 hover:bg-slate-100"
          } text-slate-600`}
        >
          <div className="text-center">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="mx-auto h-12 w-12 text-slate-400">
              <path d="M12 16a1 1 0 0 0 1-1V9.414l1.293 1.293a1 1 0 0 0 1.414-1.414l-3-3a1 1 0 0 0-1.414 0l-3 3A1 1 0 0 0 9.707 10.707L11 9.414V15a1 1 0 0 0 1 1Z" />
              <path d="M19 18H5a3 3 0 0 1-3-3 3.002 3.002 0 0 1 2.4-2.94 6.002 6.002 0 0 1 11.678-1.587A4 4 0 1 1 19 18Z" />
            </svg>
            <div className="mt-2 text-slate-600">
              或者将多张图片拖动到这里
            </div>
          </div>
        </div>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-3">
        <div className="lg:col-span-2">

          <div className="rounded-3xl border bg-white/90 p-8 md:p-10 shadow-lg">
            <h2 className="text-xl font-semibold text-slate-900">设置水印</h2>
            <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">文本</div>
                <input value={text} onChange={(e) => setText(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
              </div>
              <div>
                <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">颜色</div>
                <div className="flex items-center gap-3">
                  <input className="h-10 w-14 cursor-pointer rounded" type="color" value={color} onChange={(e) => setColor(e.target.value)} />
                  <input value={color} onChange={(e) => setColor(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                </div>
              </div>
              <div>
                <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">透明度</div>
                <div className="flex items-center gap-3">
                  <input className="w-full accent-emerald-600" type="range" min={0} max={1} step={0.01} value={opacity} onChange={(e) => setOpacity(parseFloat(e.target.value))} />
                  <span className="inline-block w-14 rounded-full bg-slate-100 px-2 py-1 text-center text-xs text-slate-700">{Math.round(opacity * 100)}%</span>
                </div>
              </div>
              <div>
                <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">字号</div>
                <div className="flex items-center gap-2">
                  <input type="number" min={8} max={300} value={fontSize} onChange={(e) => setFontSize(parseInt(e.target.value || "24"))} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                  <span className="text-sm text-slate-500">px</span>
                </div>
              </div>
              <div>
                <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">位置</div>
                <select value={position} onChange={(e) => setPosition(e.target.value as Position)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400">
                  <option value="tile">平铺</option>
                  <option value="center">居中</option>
                  <option value="top-left">左上</option>
                  <option value="bottom-right">右下</option>
                </select>
              </div>
              <div>
                <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">旋转</div>
                <div className="flex items-center gap-2">
                  <input type="number" min={-90} max={90} value={rotate} onChange={(e) => setRotate(parseInt(e.target.value || "0"))} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                  <span className="text-sm text-slate-500">°</span>
                </div>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <button
                disabled={!items.length || processing}
                onClick={onProcess}
                className={`inline-flex items-center rounded-xl px-6 py-3 text-white shadow-md ${
                  processing
                    ? "cursor-not-allowed bg-slate-400"
                    : "bg-emerald-600 hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2"
                }`}
              >
                {processing ? "处理中..." : "添加水印并下载 ZIP"}
              </button>
              <div className="text-sm text-slate-600">共 {items.length} 个文件，合计 {formatBytes(totalSize)}</div>
            </div>
            {processing && (
              <div className="mt-4">
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                  <div className="h-2 rounded-full bg-emerald-500 transition-[width] duration-300 ease-out" style={{ width: `${progress}%` }} />
                </div>
                <div className="mt-1 text-right text-xs text-slate-600">{progress}%</div>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-3xl border bg-white/90 p-8 shadow-lg">
          <h2 className="text-lg font-semibold">待处理文件</h2>
          {items.length === 0 ? (
            <div className="mt-4 text-sm text-slate-500">暂无文件</div>
          ) : (
            <div className="mt-4 max-h-[32rem] overflow-auto pr-1 text-sm">
              <div className="divide-y divide-slate-100">
                {items.map((it) => (
                  <div key={it.path} className="flex items-center justify-between gap-4 py-2">
                    <div className="truncate" title={it.path}>{it.path}</div>
                    <div className="shrink-0 text-slate-500">{formatBytes(it.file.size)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-12 rounded-3xl border bg-white/90 p-8 text-sm text-slate-700 shadow-lg">
        <div className="mb-2 text-base font-semibold">使用说明</div>
        <div className="leading-7">1. 选择或拖拽图片/目录至上方区域。</div>
        <div className="leading-7">2. 设置水印文本、颜色、透明度、字号、位置与旋转角度。</div>
        <div className="leading-7">3. 点击“添加水印并下载 ZIP”，等待处理完成自动开始下载。</div>
      </div>
    </main>
  );
}
