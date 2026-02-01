// 非标准但被 Chromium 支持的拖拽目录 API 类型声明（通过全局声明合并，避免与 lib.dom 冲突）

interface FileSystemEntry {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  fullPath: string; // 以 / 开头
}

interface FileSystemFileEntry extends FileSystemEntry {
  file: (
    successCallback: (file: File) => void,
    errorCallback?: (err: DOMException) => void
  ) => void;
}

interface FileSystemDirectoryEntry extends FileSystemEntry {
  createReader: () => FileSystemDirectoryReader;
}

interface FileSystemDirectoryReader {
  readEntries: (
    successCallback: (entries: FileSystemEntry[]) => void,
    errorCallback?: (err: DOMException) => void
  ) => void;
}

declare global {
  interface DataTransferItem {
    webkitGetAsEntry?: () => FileSystemEntry | null;
  }

  interface File {
    webkitRelativePath?: string;
  }
}

export {};
