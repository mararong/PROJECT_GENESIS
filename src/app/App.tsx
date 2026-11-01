import { useEffect, useState } from 'react';
import { ArrowRight, BookOpen, ChevronRight, Crosshair, Globe2, Layers, PanelRightOpen, Plus, Sprout, X } from 'lucide-react';
import { TopBar } from '../components/layout/TopBar';
import { SideNav } from '../components/layout/SideNav';
import { BottomControlBar } from '../components/layout/BottomControlBar';
import { CreatureInspector } from '../components/inspector/CreatureInspector';
import { EventTimeline } from '../components/timeline/EventTimeline';
import { CreateWorldDialog, PRESET_NAMES } from '../features/world/CreateWorldDialog';
import { WorldCanvas } from '../features/world/WorldCanvas';
import { Modal } from '../components/Modal';
import { useSimulation } from '../state/useSimulation';
import { findCreature } from '../state/worldState.ts';
import { loadWorldLibrary, saveWorldConfig } from '../state/worldLibrary';
import type { InspectorTab, WorldLayer } from '../state/uiState.ts';
import type { WorldConfig } from '../types/world.ts';
import type { PrototypeEvent } from '../types/event.ts';
export default function App(){
  const sim=useSimulation(),w=sim.snapshot;
  const [screen,setScreen]=useState<'worlds'|'observe'>('worlds'),[dialog,setDialog]=useState<'create'|'help'|null>(null),[library,setLibrary]=useState(loadWorldLibrary),[notice,setNotice]=useState('');
  const [selectedId,setSelectedId]=useState<number|null>(null),[followId,setFollowId]=useState<number|null>(null),[inspectorOpen,setInspectorOpen]=useState(true),[tab,setTab]=useState<InspectorTab>('overview'),[layer,setLayer]=useState<WorldLayer>('normal');
  const [timelineOpen,setTimelineOpen]=useState(true),[selectedEventId,setSelectedEventId]=useState<string|null>(null),[focusPoint,setFocusPoint]=useState<{x:number;y:number;nonce:number}|null>(null),[sheetSize,setSheetSize]=useState<'small'|'medium'|'full'>('small'),[tutorial,setTutorial]=useState(false);
  const creature=w?findCreature(w,selectedId):null,worldVisible=screen==='observe'&&!!w;
  function create(config:WorldConfig,showTutorial=true){try{sim.create(config);setScreen('observe');setDialog(null);setSelectedId(null);setFollowId(null);setSelectedEventId(null);setTab('overview');setLayer('normal');setInspectorOpen(window.innerWidth>=1280);setTimelineOpen(window.innerWidth>=768);setSheetSize('small');setTutorial(showTutorial);const saved=saveWorldConfig(config);setLibrary(saved);setNotice(saved.error);}catch(error){setNotice(error instanceof Error?error.message:'세계를 생성하지 못했습니다.');}}
  function select(id:number,record=true){setSelectedId(id);setInspectorOpen(true);setSheetSize('small');setSelectedEventId(null);setTab('overview');if(record)sim.select(id);}
  function clear(){setSelectedId(null);setFollowId(null);setTab('overview');}
  function onEvent(event:PrototypeEvent){setSelectedEventId(event.id);if(event.creatureId!==null){setSelectedId(event.creatureId);setInspectorOpen(true);setTab('overview');setSheetSize('small');}if(event.x!==undefined&&event.y!==undefined){setFollowId(null);setFocusPoint({x:event.x,y:event.y,nonce:Date.now()});}}
  useEffect(()=>{if(followId!==null&&w&&!w.creatures.some(c=>c.id===followId))setFollowId(null);},[followId,w]);
  useEffect(()=>{if(screen==='worlds')sim.setPlaying(false);},[screen,sim.setPlaying]);
  useEffect(()=>{const key=(e:KeyboardEvent)=>{
    if((e.target as HTMLElement).matches('input,textarea,select,[contenteditable=true]')||dialog||document.querySelector('[role=dialog]')||!worldVisible)return;
    if(e.code==='Space'){if((e.target as HTMLElement).closest('button,a,summary'))return;e.preventDefault();if(w!.creatures.length)sim.setPlaying(v=>!v);}
    if(e.key==='ArrowRight'&&!sim.isPlaying){e.preventDefault();sim.step();}
    if(e.key.toLowerCase()==='f'&&creature&&creature.currentAction!=='dead'){e.preventDefault();setFollowId(id=>id===creature.id?null:creature.id);}
    if(e.key==='Escape'){if(inspectorOpen)setInspectorOpen(false);else clear();}
  };window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[dialog,worldVisible,sim.isPlaying,sim.setPlaying,sim.step,creature,inspectorOpen,w]);
  const showNotice=notice||library.error;
  return <div className="app-shell"><TopBar snapshot={worldVisible?w:null} onHome={()=>{setTutorial(false);setScreen('worlds')}} onCreate={()=>setDialog('create')} onHelp={()=>setDialog('help')}/><SideNav worldVisible={worldVisible} hasWorld={!!w} onHome={()=>{setTutorial(false);setScreen('worlds')}} onObserve={()=>{setTutorial(false);setScreen('observe')}} onHelp={()=>setDialog('help')}/>
    {!worldVisible?<main className="landing"><div className="landing-copy"><div className="eyebrow"><span/> AN ARTIFICIAL LIFE SANDBOX</div><h1>작은 움직임에서,<br/><em>생명의 가능성을.</em></h1><p>하나의 씨드로 시작하는 작은 세계.<br/>서로 다른 몸을 가진 생명체의 움직임을 관찰하세요.</p><button className="primary" onClick={()=>setDialog('create')}><Plus size={18}/>새로운 세계 만들기<ChevronRight size={18}/></button><div className="landing-foot"><Sprout size={16}/>단순 행동 모델을 사용하는 UI 프로토타입입니다.</div></div><div className="orbital-art" aria-hidden="true"><div className="orbit o1"/><div className="orbit o2"/><div className="orbit o3"/><div className="cell"><i/><i/><i/><b/></div><span className="specimen-label">SPECIMEN — 001<br/><small>관찰의 시작</small></span></div>
    <section className="empty-library"><div className="library-heading"><span className="eyebrow">YOUR WORLDS</span>{w&&<button onClick={()=>{setTutorial(false);setScreen('observe')}}>현재 관측 계속하기<ArrowRight size={15}/></button>}</div>{library.items.length?<><h2>최근 생성 설정</h2><p>저장된 씨드와 조건으로 처음부터 다시 생성합니다. 진행 상태는 저장되지 않습니다.</p><div className="world-cards">{library.items.map(({config,createdAt},i)=><button className="world-card" key={`${createdAt}-${i}`} onClick={()=>create(config,false)}><Globe2 size={22}/><span><strong>{config.name}</strong><small>SEED {config.seed} · {PRESET_NAMES[config.preset]} · {config.population}개체</small><small>{new Date(createdAt).toLocaleDateString('ko-KR')} 생성 · 설정으로 다시 생성</small></span><ArrowRight size={17}/></button>)}</div></>:<><h2>아직 생성한 세계가 없습니다</h2><p>새로운 세계를 만들고 첫 관찰을 시작하세요.</p></>}</section></main>:<main className={`observatory ${inspectorOpen?'':'inspector-closed'} ${timelineOpen?'':'timeline-collapsed'}`}>
      <section className="world-stage" aria-label="세계 관측 지도"><WorldCanvas key={`${w.seed}-${w.config.name}`} snapshot={w} selectedId={selectedId} followId={followId} layer={layer} isPlaying={sim.isPlaying} speed={sim.speed} onSelect={select} onFollow={setFollowId} focusPoint={focusPoint}/><div className="canvas-hud"><span><span className="status-dot"/>{PRESET_NAMES[w.config.preset]} 생태계<small className="mono">LIVE VIEW</small></span><div className="layer-control"><Layers size={15}/><select aria-label="지도 레이어" value={layer} onChange={e=>setLayer(e.target.value as WorldLayer)}><option value="normal">자연 관찰</option><option value="foodHeatmap">먹이 분포</option><option value="speciesMap">종별 분포</option></select></div></div>
        {layer!=='normal'&&<div className="layer-legend">{layer==='foodHeatmap'?<><span className="food-gradient"/>먹이 자원량 · 적음 → 많음</>:<>● S1 청록형 · ◆ S2 보라형 · ▲ S3 주황형</>}</div>}
        {!inspectorOpen&&<button className="open-inspector" aria-label="정보 패널 열기" onClick={()=>setInspectorOpen(true)}><PanelRightOpen size={18}/><span>정보</span></button>}
        {followId!==null&&<button className="following-chip" onClick={()=>setFollowId(null)}><Crosshair size={14}/>#{String(followId).padStart(3,'0')} 추적 중 <X size={14}/></button>}
        {tutorial&&<div className="tutorial"><button aria-label="튜토리얼 건너뛰기" onClick={()=>setTutorial(false)}><X size={14}/></button><BookOpen size={20}/><strong>첫 관찰을 시작하세요</strong><p>생명체를 클릭해 몸과 상태를 살펴보세요.<br/>드래그로 이동, 휠로 확대할 수 있습니다.<br/>하단 재생 버튼 또는 <kbd>Space</kbd>로 시작합니다.</p><button className="text-button" onClick={()=>setTutorial(false)}>알겠습니다<ArrowRight size={14}/></button></div>}
        {w.creatures.length===0&&<div className="extinction-card" role="status"><Sprout size={24}/><h2>이 세계의 생명체가 모두 멸종했습니다</h2><p>에너지 고갈로 마지막 개체를 잃었습니다.<br/>사건 기록과 마지막 신체 정보는 남아 있습니다.</p><button onClick={()=>{const ids=Object.keys(w.deceased);if(ids.length)select(Number(ids[ids.length-1]),false)}}>마지막 개체 보기</button><button className="primary" onClick={()=>setDialog('create')}>새 세계 만들기<Plus size={16}/></button></div>}
        <div className="canvas-caption">128 × 128 TILES <span>SEED {w.seed}</span><small>규칙 기반 데모 · 렌더링과 논리 틱 분리</small></div>
      </section>
      {inspectorOpen&&<CreatureInspector snapshot={w} creature={creature} tab={tab} setTab={setTab} followId={followId} onFollow={setFollowId} onClose={()=>setInspectorOpen(false)} onClear={clear} onSelect={select} sheetSize={sheetSize} onSheetSize={setSheetSize}/>}
      <section className="timeline"><BottomControlBar isPlaying={sim.isPlaying} onToggle={()=>{setTutorial(false);sim.setPlaying(v=>!v)}} onStep={()=>{setTutorial(false);sim.step()}} speed={sim.speed} setSpeed={sim.setSpeed} tick={w.tick} tickRate={sim.tickRate} extinct={!w.creatures.length} timelineOpen={timelineOpen} onTimeline={()=>setTimelineOpen(v=>!v)}/>{timelineOpen&&<EventTimeline events={w.events} selectedEventId={selectedEventId} onEvent={onEvent}/>}</section>
    </main>}
    {showNotice&&<div className="app-notice" role="alert">{showNotice}<button aria-label="알림 닫기" onClick={()=>{setNotice('');setLibrary(l=>({...l,error:''}))}}><X size={15}/></button></div>}
    {dialog==='create'&&<CreateWorldDialog onClose={()=>setDialog(null)} onCreate={create}/>}
    {dialog==='help'&&<Modal title="관측소 사용 안내" onClose={()=>setDialog(null)}><div className="dialog-body help-body"><span className="eyebrow">OBSERVE / INSPECT / EXPLORE</span><h2>작은 세계를 관찰하는 방법</h2><dl className="summary-list"><div><dt>생명체 선택</dt><dd>클릭·터치 또는 개체 목록</dd></div><div><dt>카메라 이동</dt><dd>배경 드래그 · 터치 팬</dd></div><div><dt>확대·축소</dt><dd>휠 · 핀치 · <kbd>+</kbd> / <kbd>−</kbd></dd></div><div><dt>재생·일시정지</dt><dd><kbd>Space</kbd></dd></div><div><dt>한 틱 진행</dt><dd>일시정지 중 <kbd>→</kbd></dd></div><div><dt>개체 추적</dt><dd>더블클릭 · <kbd>F</kbd></dd></div><div><dt>패널·선택 닫기</dt><dd><kbd>Esc</kbd></dd></div><div><dt>모바일 시트</dt><dd>핸들 클릭·상하 스와이프</dd></div></dl><div className="notice"><Sprout size={18}/>프로토타입 시뮬레이션: 이동·섭취·에너지 규칙만 수행합니다. 실제 신경망·진화·문명 엔진은 포함하지 않습니다.</div><p className="panel-explanation">백그라운드 탭으로 전환하면 자동 일시정지합니다. 사건 클릭은 관련 개체·위치를 강조하며 시간을 되감지 않습니다. 브라우저에는 생성 설정만 저장합니다.</p><button className="primary" onClick={()=>setDialog(null)}>관찰 계속하기<ArrowRight size={16}/></button></div></Modal>}
  </div>;
}
