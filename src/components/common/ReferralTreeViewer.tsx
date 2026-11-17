import { useMemo, useState } from 'react';
import type { ReferralTreeNode } from '@/src/types/platform';
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  GitBranch,
  Layers,
  ShieldCheck,
  UserCheck,
  Users,
} from 'lucide-react';

interface ReferralTreeViewerProps {
  trees: ReferralTreeNode[];
  emptyMessage?: string;
}

function collectExpandableIds(nodes: ReferralTreeNode[]): string[] {
  const ids: string[] = [];
  const walk = (node: ReferralTreeNode) => {
    if (node.children.length > 0) {
      ids.push(node.userId);
      node.children.forEach(walk);
    }
  };
  nodes.forEach(walk);
  return ids;
}

function getMaxDepth(nodes: ReferralTreeNode[]): number {
  let max = 0;
  const walk = (node: ReferralTreeNode) => {
    if (node.depth > max) max = node.depth;
    node.children.forEach(walk);
  };
  nodes.forEach(walk);
  return max;
}

function TreeNodeRow({
  node,
  expandedIds,
  onToggle,
  depthFilter,
}: {
  node: ReferralTreeNode;
  expandedIds: Set<string>;
  onToggle: (userId: string) => void;
  depthFilter: number | 'all';
}) {
  const hasChildren = node.children.length > 0;
  const isExpanded = expandedIds.has(node.userId);
  const matchesFilter =
    depthFilter === 'all' ||
    (depthFilter === 3 ? node.depth >= 3 : node.depth === depthFilter);

  const accountBadge =
    node.accountType === 'admin'
      ? {
          label: 'Admin',
          cls: 'bg-amber-500/15 border-amber-400/35 text-amber-200',
        }
      : node.accountType === 'agent'
        ? {
            label: 'Agent',
            cls: 'bg-violet-500/15 border-violet-400/35 text-violet-200',
          }
        : {
            label: 'Player',
            cls: 'bg-blue-500/15 border-blue-400/30 text-blue-200',
          };

  return (
    <div className="space-y-1.5">
      {matchesFilter && (
        <div
          className={`rounded-xl border p-3 transition-colors ${
            node.depth === 0
              ? 'bg-[#121730] border-violet-500/35'
              : 'bg-[#080B15] border-white/10 hover:border-white/20'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-start sm:items-center gap-2.5 min-w-0">
              {hasChildren ? (
                <button
                  type="button"
                  onClick={() => onToggle(node.userId)}
                  aria-label={isExpanded ? 'Collapse descendants' : 'Expand descendants'}
                  className="w-7 h-7 rounded-lg bg-[#161C36] hover:bg-violet-600/30 border border-white/10 flex items-center justify-center text-slate-200 shrink-0 cursor-pointer"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </button>
              ) : (
                <div className="w-7 h-7 rounded-lg bg-[#0E1326] border border-white/5 flex items-center justify-center text-slate-600 shrink-0">
                  <GitBranch className="w-3.5 h-3.5" />
                </div>
              )}

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-sm font-semibold text-white truncate">
                    {node.fullName || node.username}
                  </span>
                  <span className="text-xs font-mono text-slate-400">@{node.username}</span>
                  <span
                    className={`px-2 py-0.5 rounded-md border text-[10px] font-semibold uppercase tracking-wide ${accountBadge.cls}`}
                  >
                    {accountBadge.label}
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-white/5 text-[10px] font-mono text-slate-300">
                    L{node.depth}
                  </span>
                  {node.agentCode && (
                    <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-400/25 text-[10px] font-mono text-amber-300">
                      {node.agentCode}
                    </span>
                  )}
                  {node.playerStatus === 'suspended' && (
                    <span className="px-2 py-0.5 rounded bg-rose-500/15 border border-rose-400/35 text-[10px] font-semibold text-rose-200">
                      Suspended
                    </span>
                  )}
                  {node.isFlaggedDuplicate && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-500/15 border border-rose-400/40 text-[10px] font-semibold text-rose-200">
                      <AlertTriangle className="w-3 h-3" />
                      Flagged
                    </span>
                  )}
                </div>

                <div className="text-[11px] text-slate-400 mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                  <span>Joined {new Date(node.joinedAt).toLocaleDateString()}</span>
                  <span>{node.gamesPlayed} games played</span>
                  {node.verificationStatus && (
                    <span className="inline-flex items-center gap-1 text-emerald-300">
                      <ShieldCheck className="w-3 h-3" />
                      ID: {node.verificationStatus}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs font-mono shrink-0 pl-9 sm:pl-0">
              <div className="px-2.5 py-1 rounded-lg bg-[#0F1324] border border-white/10 text-slate-200">
                Direct: <span className="text-amber-300 font-bold">{node.directCount}</span>
              </div>
              <div className="px-2.5 py-1 rounded-lg bg-[#0F1324] border border-white/10 text-slate-200">
                Network: <span className="text-emerald-300 font-bold">{node.totalDescendants}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {hasChildren && (isExpanded || depthFilter !== 'all') && (
        <div
          className={`${
            matchesFilter ? 'ml-4 sm:ml-6 pl-3 sm:pl-4 border-l border-violet-500/25' : ''
          } space-y-1.5`}
        >
          {node.children.map((child) => (
            <TreeNodeRow
              key={child.userId}
              node={child}
              expandedIds={expandedIds}
              onToggle={onToggle}
              depthFilter={depthFilter}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function ReferralTreeViewer({
  trees,
  emptyMessage = 'No referral network descendants recorded yet.',
}: ReferralTreeViewerProps) {
  const allExpandableIds = useMemo(() => collectExpandableIds(trees), [trees]);
  const maxDepth = useMemo(() => getMaxDepth(trees), [trees]);

  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    for (const root of trees) {
      initial.add(root.userId);
      for (const child of root.children) {
        if (child.children.length > 0) {
          initial.add(child.userId);
        }
      }
    }
    return initial;
  });
  const [depthFilter, setDepthFilter] = useState<number | 'all'>('all');

  const handleToggle = (userId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const expandAll = () => {
    setExpandedIds(new Set(allExpandableIds));
  };

  const collapseAll = () => {
    setExpandedIds(new Set(trees.map((t) => t.userId)));
  };

  if (trees.length === 0) {
    return (
      <div className="rounded-2xl bg-[#080B15] border border-white/10 p-8 text-center text-sm text-slate-400">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1.5 text-xs text-slate-400 mr-1">
            <Layers className="w-3.5 h-3.5 text-violet-300" />
            <span>Level View:</span>
          </span>
          <button
            type="button"
            onClick={() => setDepthFilter('all')}
            className={`px-3 py-1 rounded-lg text-xs font-medium border cursor-pointer ${
              depthFilter === 'all'
                ? 'bg-violet-600 border-violet-400 text-white'
                : 'bg-[#080B15] border-white/10 text-slate-300 hover:border-white/25'
            }`}
          >
            All Levels ({maxDepth} max depth)
          </button>
          <button
            type="button"
            onClick={() => setDepthFilter(1)}
            className={`px-3 py-1 rounded-lg text-xs font-medium border cursor-pointer ${
              depthFilter === 1
                ? 'bg-violet-600 border-violet-400 text-white'
                : 'bg-[#080B15] border-white/10 text-slate-300 hover:border-white/25'
            }`}
          >
            Level 1 (Direct)
          </button>
          <button
            type="button"
            onClick={() => setDepthFilter(2)}
            className={`px-3 py-1 rounded-lg text-xs font-medium border cursor-pointer ${
              depthFilter === 2
                ? 'bg-violet-600 border-violet-400 text-white'
                : 'bg-[#080B15] border-white/10 text-slate-300 hover:border-white/25'
            }`}
          >
            Level 2
          </button>
          <button
            type="button"
            onClick={() => setDepthFilter(3)}
            className={`px-3 py-1 rounded-lg text-xs font-medium border cursor-pointer ${
              depthFilter === 3
                ? 'bg-violet-600 border-violet-400 text-white'
                : 'bg-[#080B15] border-white/10 text-slate-300 hover:border-white/25'
            }`}
          >
            Level 3+
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={expandAll}
            className="px-3 py-1 rounded-lg bg-[#161C36] hover:bg-[#1E2648] border border-white/10 text-xs font-medium text-slate-200 inline-flex items-center gap-1 cursor-pointer"
          >
            <Users className="w-3.5 h-3.5 text-emerald-300" />
            <span>Expand All</span>
          </button>
          <button
            type="button"
            onClick={collapseAll}
            className="px-3 py-1 rounded-lg bg-[#161C36] hover:bg-[#1E2648] border border-white/10 text-xs font-medium text-slate-200 inline-flex items-center gap-1 cursor-pointer"
          >
            <UserCheck className="w-3.5 h-3.5 text-slate-300" />
            <span>Collapse</span>
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {trees.map((root) => (
          <TreeNodeRow
            key={root.userId}
            node={root}
            expandedIds={expandedIds}
            onToggle={handleToggle}
            depthFilter={depthFilter}
          />
        ))}
      </div>
    </div>
  );
}
