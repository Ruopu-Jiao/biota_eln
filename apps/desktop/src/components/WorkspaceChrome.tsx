import { Icon } from "@/components/Icon";
import type { SaveState, WorkspaceTab } from "@/types";

interface WorkspaceChromeProps {
  tabs: WorkspaceTab[];
  activeTabId?: string;
  inspectorOpen: boolean;
  onActivateTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onToggleInspector: () => void;
  onOpenPalette: () => void;
}

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === "saving")
    return <span className="tab-save-state">Saving…</span>;
  if (state === "dirty")
    return <span className="unsaved-dot" title="Unsaved changes" />;
  if (state === "conflict")
    return <Icon name="warning" size={13} className="conflict-icon" />;
  return null;
}

export function WorkspaceChrome({
  tabs,
  activeTabId,
  inspectorOpen,
  onActivateTab,
  onCloseTab,
  onToggleInspector,
  onOpenPalette,
}: WorkspaceChromeProps) {
  return (
    <>
      <header className="desktop-titlebar" data-tauri-drag-region>
        <div className="traffic-lights shell-traffic" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="titlebar-history">
          <button aria-label="Back" title="Back">
            <Icon name="back" size={17} />
          </button>
          <button aria-label="Forward" title="Forward" disabled>
            <Icon name="back" size={17} className="flip-horizontal" />
          </button>
        </div>
        <button className="titlebar-command" onClick={onOpenPalette}>
          <Icon name="search" size={14} />
          <span>Search or jump to…</span>
          <kbd>⌘K</kbd>
        </button>
        <div className="titlebar-actions">
          <button
            className={inspectorOpen ? "is-active" : ""}
            onClick={onToggleInspector}
            aria-label="Toggle inspector"
            title="Toggle inspector"
          >
            <Icon name="panel" size={17} />
          </button>
          <button aria-label="More options" title="More options">
            <Icon name="dots" size={18} />
          </button>
        </div>
      </header>
      <div className="workspace-tabs" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`workspace-tab ${tab.id === activeTabId ? "is-active" : ""}`}
            onClick={() => onActivateTab(tab.id)}
            role="tab"
            aria-selected={tab.id === activeTabId}
          >
            <Icon
              name={
                tab.recordType === "experiment"
                  ? "experiment"
                  : tab.recordType === "protocol"
                    ? "protocol"
                    : tab.recordType === "analysis"
                      ? "analysis"
                      : "document"
              }
              size={14}
            />
            <span>{tab.title}</span>
            <SaveIndicator state={tab.saveState} />
            <span
              className="tab-close"
              role="button"
              tabIndex={0}
              aria-label={`Close ${tab.title}`}
              onClick={(event) => {
                event.stopPropagation();
                onCloseTab(tab.id);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ")
                  onCloseTab(tab.id);
              }}
            >
              <Icon name="close" size={12} />
            </span>
          </button>
        ))}
        <div className="tabs-empty-space" data-tauri-drag-region />
      </div>
    </>
  );
}
