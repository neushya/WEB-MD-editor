import React, { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown, Folder, FileText, FolderOpen, FolderPlus, RefreshCw, PanelLeftClose, X } from 'lucide-react';
import { fileSystemService } from '../services/FileSystemService';
import type { FileEntry as WebFileEntry } from '../services/FileSystemService';

interface Root {
  id: string;
  handle: FileSystemDirectoryHandle;
}

interface SidebarProps {
  roots: Root[];
  onFileOpen: (handle: FileSystemFileHandle) => void;
  onFolderOpen: () => void;
  onAddFolder: () => void;
  onRemoveRoot: (id: string) => void;
  activeFileHandle: FileSystemFileHandle | null;
  width: number;
  onToggle: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ roots, onFileOpen, onFolderOpen, onAddFolder, onRemoveRoot, activeFileHandle, width, onToggle }) => {
  // 전역 새로고침 신호: 모든 루트 노드가 이 값 변경 시 재조회
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefresh = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRefreshKey(prev => prev + 1);
  };

  if (width === 0) return null;

  return (
    <div
      className="bg-[var(--bg-sidebar)] flex flex-col overflow-hidden select-none font-sans h-full border-r border-[var(--border-base)]"
      style={{ width: `${width}px` }}
    >
      <div className="flex items-center justify-between px-3 h-8 bg-[var(--bg-header)] text-[11px] shrink-0 border-b border-[var(--border-base)]">
        <div className="flex items-center text-[var(--text-main)] font-bold tracking-tight">
          <button
            onClick={onToggle}
            className="p-0.5 hover:bg-[var(--bg-item-hover)] rounded mr-1.5 text-[var(--text-muted)] transition-colors border-none shadow-none outline-none bg-transparent cursor-default"
            title="사이드바 확대/축소"
          >
            <PanelLeftClose size={14} strokeWidth={2.5} />
          </button>
          <span className="uppercase tracking-widest opacity-80">Project</span>
        </div>
        <div className="flex items-center space-x-3 text-[var(--text-muted)]">
          <button onClick={onAddFolder} title="폴더 추가" className="hover:text-[var(--text-main)] transition-colors border-none shadow-none outline-none bg-transparent">
            <FolderPlus size={15} strokeWidth={1.5} />
          </button>
          <button onClick={onFolderOpen} title="폴더 열기" className="hover:text-[var(--text-main)] transition-colors border-none shadow-none outline-none bg-transparent">
            <FolderOpen size={15} strokeWidth={1.5} />
          </button>
          <button onClick={handleRefresh} title="새로고침" className="hover:text-[var(--text-main)] transition-colors border-none shadow-none outline-none bg-transparent">
            <RefreshCw size={14} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto py-1 text-[13px] text-[var(--text-main)] custom-scrollbar">
        {roots.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-6 text-center">
            <p className="text-[var(--text-muted)] text-[11px] mb-4">No project opened</p>
            <button
              onClick={onFolderOpen}
              className="px-4 py-1.5 bg-[var(--bg-item-hover)] text-[var(--text-main)] rounded-sm hover:bg-[var(--bg-item-active)] text-[12px] shadow-sm border border-[var(--border-base)]"
            >
              Open Folder
            </button>
          </div>
        ) : (
          <div className="min-w-full">
            {roots.map(root => (
              <RootFolderNode
                key={root.id}
                root={root}
                refreshSignal={refreshKey}
                onFileOpen={onFileOpen}
                onRemoveRoot={onRemoveRoot}
                activeFileHandle={activeFileHandle}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

interface RootFolderNodeProps {
  root: Root;
  refreshSignal: number;
  onFileOpen: (handle: FileSystemFileHandle) => void;
  onRemoveRoot: (id: string) => void;
  activeFileHandle: FileSystemFileHandle | null;
}

// 루트 폴더 1개를 담당: 자체 권한/엔트리/펼침 상태 보유
const RootFolderNode: React.FC<RootFolderNodeProps> = ({ root, refreshSignal, onFileOpen, onRemoveRoot, activeFileHandle }) => {
  const [entries, setEntries] = useState<WebFileEntry[]>([]);
  const [isRootOpen, setIsRootOpen] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);

  const loadDir = async (handle: FileSystemDirectoryHandle) => {
    try {
      const result = await fileSystemService.getDirectoryEntries(handle);
      setEntries(result);
    } catch (err) {
      console.error("Failed to read root directory:", err);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const checkAuth = async () => {
      const granted = await fileSystemService.verifyPermission(root.handle, false);
      if (cancelled) return;
      setIsAuthorized(granted);
      if (granted) loadDir(root.handle);
    };
    checkAuth();
    return () => { cancelled = true; };
  }, [root.handle, refreshSignal]);

  const handleReAuthorize = async () => {
    const granted = await fileSystemService.verifyPermission(root.handle, true);
    if (granted) {
      setIsAuthorized(true);
      loadDir(root.handle);
    }
  };

  return (
    <div className="min-w-full">
      <div
        className="group flex items-center px-2 py-0.5 hover:bg-[var(--bg-item-hover)] cursor-default font-semibold transition-colors"
        onClick={() => setIsRootOpen(!isRootOpen)}
      >
        <span className="w-4 flex items-center justify-center shrink-0">
          {isRootOpen ? <ChevronDown size={14} className="text-[var(--text-muted)]" /> : <ChevronRight size={14} className="text-[var(--text-muted)]" />}
        </span>
        <Folder size={14} className="mr-1.5 text-[var(--text-muted)] shrink-0" />
        <span className="truncate flex-1">{root.handle.name}</span>
        <button
          onClick={(e) => { e.stopPropagation(); onRemoveRoot(root.id); }}
          title="폴더 삭제"
          className="ml-1 opacity-0 group-hover:opacity-100 hover:bg-[var(--bg-item-active)] rounded p-0.5 text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors border-none shadow-none outline-none bg-transparent shrink-0"
        >
          <X size={13} />
        </button>
      </div>

      {!isAuthorized ? (
        <div className="px-3 py-2 flex flex-col items-start">
          <p className="text-[var(--text-muted)] text-[10px] mb-1.5">접근 권한이 필요합니다</p>
          <button
            onClick={handleReAuthorize}
            className="px-2.5 py-1 bg-orange-500 text-white rounded-sm hover:bg-orange-600 text-[11px] shadow-sm transition-colors"
          >
            폴더 재연결
          </button>
        </div>
      ) : isRootOpen && (
        // key={refreshSignal}: 새로고침 시 하위 트리까지 리마운트하여 펼쳐진 폴더 변경분도 재조회
        <div className="min-w-full" key={refreshSignal}>
          {entries.map(entry => (
            <FileTreeItem
              key={entry.name}
              entry={entry}
              onFileOpen={onFileOpen}
              depth={1}
              activeFileHandle={activeFileHandle}
            />
          ))}
        </div>
      )}
    </div>
  );
};

interface FileTreeItemProps {
  entry: WebFileEntry;
  onFileOpen: (handle: FileSystemFileHandle) => void;
  depth: number;
  activeFileHandle: FileSystemFileHandle | null;
}

const FileTreeItem: React.FC<FileTreeItemProps> = ({ entry, onFileOpen, depth, activeFileHandle }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [subEntries, setSubEntries] = useState<WebFileEntry[]>([]);

  const [isActive, setIsActive] = useState(false);

  // active 판정: 이름이 다르면 즉시 false(동기), 이름이 충돌할 때만
  // FileSystemHandle.isSameEntry로 핸들 동일성 정밀 비교(다른 폴더 동명 파일 구분)
  useEffect(() => {
    let cancelled = false;
    if (!activeFileHandle || entry.kind !== 'file' || entry.name !== activeFileHandle.name) {
      setIsActive(false);
      return;
    }
    (activeFileHandle as FileSystemHandle)
      .isSameEntry(entry.handle as FileSystemHandle)
      .then(same => { if (!cancelled) setIsActive(same); })
      .catch(() => { if (!cancelled) setIsActive(false); });
    return () => { cancelled = true; };
  }, [activeFileHandle, entry.handle, entry.kind, entry.name]);

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (entry.kind === 'directory') {
      if (!isOpen) {
        try {
          const result = await fileSystemService.getDirectoryEntries(entry.handle as FileSystemDirectoryHandle);
          setSubEntries(result);
        } catch (err) {
          console.error("Failed to read directory:", err);
        }
      }
      setIsOpen(!isOpen);
    } else {
      onFileOpen(entry.handle as FileSystemFileHandle);
    }
  };

  return (
    <div className="w-full">
      <div
        className={`flex items-center py-[1px] cursor-default select-none transition-colors group ${
          isActive
            ? 'bg-[var(--bg-item-active)] text-white'
            : 'hover:bg-[var(--bg-item-hover)] text-[var(--text-main)]'
        }`}
        style={{ paddingLeft: `${depth * 12 + 12}px`, paddingRight: '8px' }}
        onClick={handleClick}
      >
        <span className="w-4 flex items-center justify-center shrink-0">
          {entry.kind === 'directory' && (
            isOpen ? <ChevronDown size={14} className={isActive ? 'text-white' : 'text-[var(--text-muted)]'} /> : <ChevronRight size={14} className={isActive ? 'text-white' : 'text-[var(--text-muted)]'} />
          )}
        </span>
        <span className="mr-1.5 flex items-center shrink-0 scale-90">
          {entry.kind === 'directory'
            ? <Folder size={16} className={isActive ? 'text-white' : 'text-[var(--text-muted)]'} />
            : <FileText size={16} className={isActive ? 'text-white' : (entry.name.endsWith('.md') ? "text-[var(--accent)]" : "text-[var(--text-muted)]")} />
          }
        </span>
        <span className="truncate flex-1 font-normal">{entry.name}</span>
      </div>

      {isOpen && entry.kind === 'directory' && (
        <div className="w-full">
          {subEntries.length > 0 ? (
            subEntries.map(sub => (
              <FileTreeItem
                key={sub.name}
                entry={sub}
                onFileOpen={onFileOpen}
                depth={depth + 1}
                activeFileHandle={activeFileHandle}
              />
            ))
          ) : (
            <div
              className="py-0.5 text-[11px] text-[var(--text-muted)] italic"
              style={{ paddingLeft: `${(depth + 1) * 12 + 28}px` }}
            >
              (empty)
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Sidebar;
