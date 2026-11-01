import { Activity, CircleHelp, GitBranch, Globe2, History, Network, Trees } from 'lucide-react';
export function SideNav({ viewingWorld: givenViewingWorld, worldVisible, hasWorld, onHome, onObserve, onHistory, onHelp }: { viewingWorld?: boolean; worldVisible?: boolean; hasWorld: boolean; onHome: () => void; onObserve: () => void; onHistory?: () => void; onHelp: () => void }) {
  const viewingWorld = givenViewingWorld ?? worldVisible ?? false;
  return <nav className="side-nav" aria-label="주 메뉴">
    <button aria-label="세계 목록" title="세계 목록" aria-current={!viewingWorld ? 'page' : undefined} className={!viewingWorld ? 'active' : ''} onClick={onHome}><Globe2/></button>
    <button aria-label="세계 관측소" title="세계 관측소" aria-current={viewingWorld ? 'page' : undefined} className={viewingWorld ? 'active' : ''} disabled={!hasWorld} onClick={onObserve}><Activity/></button><span/>
    <button disabled title="두뇌 관찰실 · 준비 중" aria-label="두뇌 관찰실 준비 중"><Network/></button>
    <button disabled title="진화 계통수 · 준비 중" aria-label="진화 계통수 준비 중"><GitBranch/></button>
    <button disabled title="문명 관측소 · 준비 중" aria-label="문명 관측소 준비 중"><Trees/></button>
    {onHistory && <button aria-label="사건 기록 보기" title="사건 기록 보기" disabled={!viewingWorld} onClick={onHistory}><History/></button>}
    <button className="nav-bottom" aria-label="도움말" title="도움말 · 단축키" onClick={onHelp}><CircleHelp/></button>
  </nav>;
}
