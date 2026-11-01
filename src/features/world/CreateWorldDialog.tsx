import { useMemo, useState } from 'react';
import { ArrowLeft, ChevronRight, Shuffle, Sprout } from 'lucide-react';
import { DEFAULT_CONFIG, generateWorld, validateConfig } from '../../simulation/worldGenerator';
import type { MapPreset, WorldConfig } from '../../types/world';
import { CreaturePreview } from '../../components/inspector/CreaturePreview';
import { MiniMap } from './MiniMap';
import { Modal } from '../../components/Modal';
export const PRESET_NAMES = { balanced: '균형', forest: '숲', arid: '건조' };

export function CreateWorldDialog({ onCreate, onClose }: { onCreate: (config: WorldConfig) => void; onClose?: () => void }) {
  return onClose ? <Modal title="새로운 세계 만들기" onClose={onClose}><CreateWorldForm onCreate={onCreate}/></Modal> : <CreateWorldForm onCreate={onCreate}/>;
}
function CreateWorldForm({ onCreate }: { onCreate: (config: WorldConfig) => void }) {
  const [config, setConfig] = useState<WorldConfig>({ ...DEFAULT_CONFIG });
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const preview = useMemo(() => generateWorld({ ...DEFAULT_CONFIG, seed: Number.isInteger(config.seed) && config.seed >= 0 && config.seed <= 4294967295 ? config.seed : 2026, preset: config.preset, population: 10 }), [config.seed, config.preset]);
  const update = (change: Partial<WorldConfig>) => { setConfig(c => ({ ...c, ...change })); setError(null); };
  function next() { const issue = validateConfig(config); setError(issue); if (!issue) setStep(s => s + 1); }
  return <div className="wizard">
    <div className="wizard-steps">{['행성 조건', '최초 생명체', '확인 · 생성'].map((label, i) => <div key={label} className={step === i + 1 ? 'active' : step > i + 1 ? 'complete' : ''}><span>{String(i + 1).padStart(2, '0')}</span>{label}</div>)}</div>
    <div className="wizard-layout"><div className="wizard-fields">
      <span className="eyebrow">A NEW BEGINNING / 0{step}</span>
      <h2>{step === 1 ? '어떤 세계를 관찰할까요?' : step === 2 ? '작은 생명의 시작' : '첫 관찰을 시작할 준비'}</h2>
      {step === 1 && <>
        <label>세계 이름<input autoFocus maxLength={40} value={config.name} onChange={e => update({ name: e.target.value })}/></label>
        <label>난수 씨드<div className="input-with-button"><input aria-label="난수 씨드" type="number" min="0" max="4294967295" step="1" value={Number.isNaN(config.seed) ? '' : config.seed} onChange={e => update({ seed: e.target.value === '' ? NaN : Number(e.target.value) })}/><button aria-label="씨드 자동 생성" title="씨드 자동 생성" onClick={() => update({ seed: crypto.getRandomValues(new Uint32Array(1))[0] })}><Shuffle size={17}/></button></div><small>동일한 씨드와 설정은 동일한 초기 세계를 만듭니다.</small></label>
        <label>맵 프리셋<select value={config.preset} onChange={e => update({ preset: e.target.value as MapPreset })}><option value="balanced">균형 · 풍부한 평원과 숲</option><option value="forest">숲 · 높은 자원 밀도</option><option value="arid">건조 · 제한된 먹이 자원</option></select></label>
        <p className="form-note">128 × 128 논리 타일 · 물 / 평원 / 숲 / 바위</p>
      </>}
      {step === 2 && <>
        <label>시작 개체수<input autoFocus type="number" min="10" max="100" step="1" value={Number.isNaN(config.population) ? '' : config.population} onChange={e => update({ population: e.target.value === '' ? NaN : Number(e.target.value) })}/><small>10~100마리. 기본값은 50마리입니다.</small></label>
        <div className="notice"><Sprout size={19}/><span>몸통 + 이동기관 1~4개 + 감각기관 1~3개 + 섭식기관. 씨드에 따라 기관의 크기와 부착 위치가 달라집니다.</span></div>
        <p className="form-note">세 가지 종 표식은 관찰용 분류입니다. 자연선택, 돌연변이와 번식은 이번 데모에서 실행하지 않습니다.</p>
      </>}
      {step === 3 && <><dl className="data-list"><div><dt>세계 이름</dt><dd>{config.name}</dd></div><div><dt>씨드</dt><dd>{config.seed}</dd></div><div><dt>지형</dt><dd>{PRESET_NAMES[config.preset]}</dd></div><div><dt>초기 개체</dt><dd>{config.population}마리 / 3종</dd></div><div><dt>초기 상태</dt><dd>일시정지</dd></div></dl><div className="notice">이동 · 먹이 탐색 · 섭취 · 에너지 소비를 사용하는 프로토타입입니다. 생성 조건만 브라우저에 저장하며, 진행 상태는 저장하지 않습니다.</div></>}
      {error && <p role="alert" className="error-message">{error}</p>}
    </div><div className="wizard-preview"><span className="eyebrow">{step === 2 ? 'BODY PREVIEW' : 'TERRAIN PREVIEW'}</span>{step === 2 ? <CreaturePreview creature={preview.creatures[0]}/> : <MiniMap world={preview}/>}<small>미리보기 · 시뮬레이션 결과가 아닙니다</small></div></div>
    <div className="dialog-footer"><button onClick={() => setStep(s => s - 1)} disabled={step === 1}><ArrowLeft size={16}/>이전</button>{step < 3 ? <button className="primary" onClick={next}>다음<ChevronRight size={16}/></button> : <button className="primary" onClick={() => { const issue = validateConfig(config); setError(issue); if (!issue) onCreate(config); }}>세계 생성<Sprout size={16}/></button>}</div>
  </div>;
}
