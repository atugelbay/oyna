"use client";

interface Tab {
  id: string;
  label: string;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (id: string) => void;
}

export function Tabs({ tabs, activeTab, onChange }: TabsProps) {
  return (
    <div className="flex bg-bg-card rounded-lg p-1 border border-surface-border">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`
              flex-1 h-9 rounded-md text-sm font-medium transition-all duration-200
              flex items-center justify-center gap-1.5 cursor-pointer
              ${isActive
                ? "bg-cyan/15 text-cyan border border-cyan/30"
                : "text-text-secondary hover:text-text-primary"
              }
            `}
          >
            {isActive && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
