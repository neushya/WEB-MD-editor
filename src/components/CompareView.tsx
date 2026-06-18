import { useEffect, useRef, useState } from 'react';
import { basicSetup } from 'codemirror';
import { EditorState, StateField, RangeSetBuilder, Text } from '@codemirror/state';
import { EditorView, Decoration } from '@codemirror/view';
import type { DecorationSet } from '@codemirror/view';
import { markdown } from '@codemirror/lang-markdown';
import { oneDark } from '@codemirror/theme-one-dark';
import { Chunk } from '@codemirror/merge';
import { FilePlus, X, GitCompare, Undo2 } from 'lucide-react';
import { fileSystemService } from '../services/FileSystemService';

interface CompareFile {
  name: string;
  content: string;
}

interface CompareViewProps {
  isDarkMode: boolean;
  onClose: () => void;
}

// 비교 불가(바이너리/미디어) 확장자 — 텍스트 전용
const NON_TEXT_EXT = [
  'pdf', 'png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'ico', 'svg', 'mp4', 'mov', 'avi', 'mkv', 'webm',
  'flv', 'mp3', 'wav', 'ogg', 'm4a', 'flac', 'zip', 'rar', '7z', 'tar', 'gz', 'exe', 'dll', 'so',
  'dylib', 'bin', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'
];

const lightTheme = EditorView.theme({
  '&': { backgroundColor: '#ffffff', color: '#1f2937' },
  '.cm-content': { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' },
  '.cm-gutters': { backgroundColor: '#f3f4f6', color: '#6b7280', borderRight: '1px solid #d1d5db' },
  '.cm-activeLine': { backgroundColor: 'transparent' },
});

// 변경 구간(chunk)이 걸친 줄들을 line decoration으로 표시
const addLineDecos = (builder: RangeSetBuilder<Decoration>, doc: Text, from: number, to: number, cls: string) => {
  if (from >= to) return; // 이 쪽에 내용이 없는 구간(반대편 순수 추가/삭제) → 표시 없음
  let line = doc.lineAt(from);
  while (line.from < to) {
    builder.add(line.from, line.from, Decoration.line({ class: cls }));
    if (line.to + 1 > doc.length) break;
    line = doc.lineAt(line.to + 1);
  }
};

const diffDecoField = (chunks: readonly Chunk[], side: 'a' | 'b') =>
  StateField.define<DecorationSet>({
    create(state) {
      const builder = new RangeSetBuilder<Decoration>();
      const cls = side === 'a' ? 'cmp-del' : 'cmp-add';
      for (const ch of chunks) {
        const from = side === 'a' ? ch.fromA : ch.fromB;
        const to = side === 'a' ? ch.toA : ch.toB;
        addLineDecos(builder, state.doc, from, to, cls);
      }
      return builder.finish();
    },
    update(value) { return value; }, // 읽기 전용 → 정적
    provide: f => EditorView.decorations.from(f),
  });

const CompareView: React.FC<CompareViewProps> = ({ isDarkMode, onClose }) => {
  const [fileA, setFileA] = useState<CompareFile | null>(null);
  const [fileB, setFileB] = useState<CompareFile | null>(null);
  const [showDiff, setShowDiff] = useState(false);

  const aRef = useRef<HTMLDivElement>(null);
  const bRef = useRef<HTMLDivElement>(null);

  const pickFile = async (side: 'a' | 'b') => {
    try {
      const [handle] = await window.showOpenFilePicker({ multiple: false });
      if (!handle) return;
      const ext = handle.name.split('.').pop()?.toLowerCase() || '';
      if (NON_TEXT_EXT.includes(ext)) { alert('텍스트 파일만 비교할 수 있습니다.'); return; }
      const content = await fileSystemService.readFile(handle);
      setShowDiff(false); // 파일이 바뀌면 비교 결과는 무효 → 재비교 유도
      if (side === 'a') setFileA({ name: handle.name, content });
      else setFileB({ name: handle.name, content });
    } catch (err) { if ((err as Error).name !== 'AbortError') alert(`파일을 열 수 없습니다.\n\n사유: ${err}`); }
  };

  // diff 모드: 독립 스크롤 2-에디터 생성 (isDarkMode 변경 시 재생성)
  useEffect(() => {
    if (!showDiff || !fileA || !fileB || !aRef.current || !bRef.current) return;

    const docA = Text.of(fileA.content.split('\n'));
    const docB = Text.of(fileB.content.split('\n'));
    const chunks = Chunk.build(docA, docB);
    const themeExt = isDarkMode ? oneDark : lightTheme;
    const heightTheme = EditorView.theme({ '&': { height: '100%' }, '.cm-scroller': { overflow: 'auto' } });

    const buildView = (parent: HTMLDivElement, content: string, side: 'a' | 'b') => new EditorView({
      doc: content,
      extensions: [
        basicSetup,
        markdown(),
        themeExt,
        heightTheme,
        EditorState.readOnly.of(true),
        EditorView.editable.of(false),
        diffDecoField(chunks, side),
      ],
      parent,
    });

    const viewA = buildView(aRef.current, fileA.content, 'a');
    const viewB = buildView(bRef.current, fileB.content, 'b');
    return () => { viewA.destroy(); viewB.destroy(); };
  }, [showDiff, fileA, fileB, isDarkMode]);

  const canCompare = !!fileA && !!fileB;

  return (
    <div className="h-full w-full flex flex-col bg-[var(--bg-app)]">
      {/* 상단 툴바 */}
      <div className="flex items-center justify-between px-3 h-9 bg-[var(--bg-tabbar)] border-b border-[var(--border-base)] shrink-0 select-none">
        <div className="flex items-center gap-2 text-[12px] font-semibold text-[var(--text-main)]">
          <GitCompare size={14} className="text-[var(--accent)]" />
          <span>파일 비교</span>
        </div>
        <div className="flex items-center gap-2">
          {showDiff ? (
            <button
              onClick={() => setShowDiff(false)}
              className="flex items-center gap-1 px-2.5 py-1 rounded text-[11px] text-[var(--text-muted)] hover:bg-[var(--bg-item-hover)] hover:text-[var(--text-main)] transition-colors border-none shadow-none outline-none bg-transparent"
              title="비교 화면 닫기"
            >
              <Undo2 size={13} /> 되돌리기
            </button>
          ) : (
            <button
              onClick={() => canCompare && setShowDiff(true)}
              disabled={!canCompare}
              className={`flex items-center gap-1 px-3 py-1 rounded text-[11px] transition-colors border-none shadow-none outline-none ${
                canCompare
                  ? 'bg-[var(--accent)] text-white hover:opacity-90 cursor-pointer'
                  : 'bg-[var(--bg-item-hover)] text-[var(--text-muted)] cursor-not-allowed'
              }`}
              title={canCompare ? '두 파일 비교' : 'A·B 파일을 모두 선택하세요'}
            >
              <GitCompare size={13} /> 비교
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1 rounded text-[var(--text-muted)] hover:bg-[var(--bg-item-active)] hover:text-[var(--text-main)] transition-colors border-none shadow-none outline-none bg-transparent"
            title="파일 비교 닫기"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* 본문 */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {showDiff && canCompare ? (
          <div className="h-full w-full flex flex-col">
            <style>{`
              .cmp-del { background: rgba(248, 81, 73, 0.18); }
              .cmp-add { background: rgba(46, 160, 67, 0.20); }
              .cmp-editor .cm-editor { height: 100%; font-size: 13px; }
            `}</style>
            <div className="flex items-center text-[11px] text-[var(--text-muted)] border-b border-[var(--border-base)] shrink-0 select-none">
              <div className="flex-1 px-3 py-1 truncate border-r border-[var(--border-base)]">A: {fileA.name}</div>
              <div className="flex-1 px-3 py-1 truncate">B: {fileB.name}</div>
            </div>
            {/* 독립 스크롤: 각 패널 에디터가 자체 .cm-scroller로 스크롤 */}
            <div className="flex-1 min-h-0 flex">
              <div ref={aRef} className="flex-1 min-w-0 h-full cmp-editor" />
              <div className="w-px bg-[var(--border-base)] shrink-0" />
              <div ref={bRef} className="flex-1 min-w-0 h-full cmp-editor" />
            </div>
          </div>
        ) : (
          <div className="h-full w-full flex">
            <ComparePane side="A" file={fileA} onPick={() => pickFile('a')} />
            <div className="w-px bg-[var(--border-base)] shrink-0" />
            <ComparePane side="B" file={fileB} onPick={() => pickFile('b')} />
          </div>
        )}
      </div>
    </div>
  );
};

interface ComparePaneProps {
  side: 'A' | 'B';
  file: CompareFile | null;
  onPick: () => void;
}

const ComparePane: React.FC<ComparePaneProps> = ({ side, file, onPick }) => {
  return (
    <div className="flex-1 min-w-0 h-full flex flex-col">
      <div className="flex items-center justify-between px-3 h-7 bg-[var(--bg-sidebar)] border-b border-[var(--border-base)] shrink-0 select-none">
        <span className="text-[11px] font-bold text-[var(--text-muted)]">{side}</span>
        {file && (
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[11px] text-[var(--text-main)] truncate">{file.name}</span>
            <button
              onClick={onPick}
              className="text-[10px] text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors border-none shadow-none outline-none bg-transparent shrink-0"
              title="다른 파일 선택"
            >
              변경
            </button>
          </div>
        )}
      </div>
      <div className="flex-1 min-h-0 overflow-auto custom-scrollbar">
        {file ? (
          <pre className="text-[13px] font-mono p-3 whitespace-pre text-[var(--text-main)] leading-relaxed">{file.content}</pre>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center p-6">
            <button
              onClick={onPick}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-item-hover)] text-[var(--text-main)] rounded hover:bg-[var(--bg-item-active)] text-[12px] border border-[var(--border-base)] shadow-sm transition-colors"
            >
              <FilePlus size={15} /> 파일 추가
            </button>
            <p className="text-[10px] text-[var(--text-muted)] mt-3">비교할 {side} 파일을 선택하세요</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CompareView;
