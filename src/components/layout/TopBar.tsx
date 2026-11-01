import { Atom, Camera, CircleHelp, Maximize, Minimize, PanelRight, Plus } from 'lucide-react';
import type { WorldState } from '../../types/world';
export function TopBar({ world: givenWorld, snapshot, onHome, onCreate, onSave, onPanel, fullscreen, onFullscreen, onHelp }: { world?: WorldState | null; snapshot?: WorldState | null; onHome: () => void; onCreate: () => void; onSave?: () => void; onPanel?: () => void; fullscreen?: boolean; onFullscreen?: () => void; onHelp?: () => void }) {
  const world = givenWorld ?? snapshot ?? null;
  return <header className="topbar"><a className="brand" href="#" onClick={e => { e.preventDefault(); onHome(); }} aria-label="GENESIS 세계 목록"><Atom size={30}/><span>GENESIS<small>LIVING OBSERVATORY</small></span></a><span className="header-divider"/>
    <div className="world-heading">{world?.config.name ?? '세계 보관소'}<small>{world ? `SEED ${world.seed} / 128 × 128` : 'PROJECT GENESIS / M0'}</small></div>
    {world && <div className="header-metrics"><span><small>TICK</small><b data-testid="header-tick">{String(world.tick).padStart(6, '0')}</b></span><span><small>개체</small><b>{world.creatures.length}</b></span><span><small>기본 종</small><b>{new Set(world.creatures.map(c => c.speciesId)).size}</b></span></div>}
    <span className="prototype-badge"><span className="status-dot"/>M0 생태계 시뮬레이션</span>
    <div className="header-actions">{world && <>{onSave && <button title="현재 세계 저장" aria-label="현재 세계 저장" onClick={onSave}><Camera size={18}/></button>}{onPanel && <button title="정보 패널 열기" aria-label="정보 패널 열기" onClick={onPanel}><PanelRight size={18}/></button>}{onFullscreen && <button title="전체 화면 전환" aria-label="전체 화면 전환" onClick={onFullscreen}>{fullscreen ? <Minimize size={18}/> : <Maximize size={18}/>}</button>}</>}{onHelp && <button aria-label="도움말" title="사용 안내" onClick={onHelp}><CircleHelp size={18}/></button>}<button aria-label="새 세계 만들기" title="새 세계 만들기" onClick={onCreate}><Plus size={19}/></button></div>
  </header>;
}
