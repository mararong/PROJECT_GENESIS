import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../app/App';
import { CreatureInspector } from '../components/inspector/CreatureInspector';
import { EventTimeline } from '../components/timeline/EventTimeline';
import { MockEngine } from '../simulation/mockEngine';
import { DEFAULT_CONFIG } from '../simulation/worldGenerator';
import { loadWorldLibrary, saveWorldConfig } from '../state/worldLibrary';

// UI integration tests use the real model and clock; GPU rendering is covered by browser QA.
vi.mock('../features/world/WorldCanvas', () => ({ WorldCanvas: ({ snapshot, onSelect, selectedId }: { snapshot: ReturnType<MockEngine['getSnapshot']>; onSelect: (id: number) => void; selectedId: number | null }) => <div aria-label="테스트 지도" data-selected={selectedId}><button onClick={() => onSelect(snapshot.creatures[0].id)}>첫 개체 선택</button></div> }));
beforeEach(() => { localStorage.clear(); vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null); });
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });
function createWorld() {
  fireEvent.click(screen.getByRole('button', { name: '새로운 세계 만들기' }));
  fireEvent.click(screen.getByRole('button', { name: '다음' }));
  fireEvent.click(screen.getByRole('button', { name: '다음' }));
  fireEvent.click(screen.getByRole('button', { name: '세계 생성' }));
}
describe('P2/P3: generation and inspector', () => {
  it('validates numeric input, preserves fields going backwards, creates a real seeded world', () => {
    render(<App/>); fireEvent.click(screen.getByRole('button', { name: '새로운 세계 만들기' }));
    const seed = screen.getByRole('spinbutton', { name: '난수 씨드' });
    fireEvent.change(seed, { target: { value: '-1' } }); fireEvent.click(screen.getByRole('button', { name: '다음' }));
    expect(screen.getByRole('alert')).toHaveTextContent('씨드');
    fireEvent.change(seed, { target: { value: '1234' } }); fireEvent.click(screen.getByRole('button', { name: '다음' }));
    fireEvent.change(screen.getByRole('spinbutton', { name: /시작 개체수/ }), { target: { value: '25' } });
    fireEvent.click(screen.getByRole('button', { name: '이전' })); expect(screen.getByRole('spinbutton', { name: '난수 씨드' })).toHaveValue(1234);
    fireEvent.click(screen.getByRole('button', { name: '다음' })); expect(screen.getByRole('spinbutton', { name: /시작 개체수/ })).toHaveValue(25);
    fireEvent.click(screen.getByRole('button', { name: '다음' })); fireEvent.click(screen.getByRole('button', { name: '세계 생성' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(); expect(screen.getByTestId('header-tick')).toHaveTextContent('000000');
    expect(screen.getByRole('button', { name: '재생' })).toBeInTheDocument(); expect(loadWorldLibrary().items[0].config.seed).toBe(1234);
  });
  it('keeps the same selected ID across tabs, panel hiding, and camera tracking', () => {
    render(<App/>); createWorld(); fireEvent.click(screen.getByRole('button', { name: '첫 개체 선택' }));
    const panel = screen.getByRole('complementary', { name: '개체 상세' });
    expect(within(panel).getByText('#001')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /신체/ })); expect(screen.getAllByText('core ← ROOT').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('tab', { name: '유전자' })); expect(screen.getByText('이동 속도')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /개체 1의 신체 구조/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '정보 패널 닫기' })); expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '정보 패널 열기' })); expect(screen.getByText('#001')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: '개요' })); fireEvent.click(screen.getByRole('button', { name: /이 개체 추적/ }));
    expect(screen.getByRole('button', { name: /추적 중단/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '선택 해제' })); expect(screen.getByRole('complementary', { name: '세계 개요' })).toBeInTheDocument();
  });
});
describe('P4: UI uses actual logical time and actual events', () => {
  it('steps exactly once, freezes when paused, runs faster at 10×, and pauses in the world library', async () => {
    vi.useFakeTimers(); render(<App/>); createWorld();
    fireEvent.click(screen.getByRole('button', { name: '다음 틱' })); expect(screen.getByTestId('header-tick')).toHaveTextContent('000001');
    await act(async () => { vi.advanceTimersByTime(1000); }); expect(screen.getByTestId('header-tick')).toHaveTextContent('000001');
    fireEvent.click(screen.getByRole('button', { name: '10배속' })); fireEvent.click(screen.getByRole('button', { name: '재생' }));
    await act(async () => { vi.advanceTimersByTime(1000); }); const tick = Number(screen.getByTestId('header-tick').textContent); expect(tick).toBeGreaterThan(80);
    fireEvent.click(screen.getByRole('button', { name: '일시정지' })); await act(async () => { vi.advanceTimersByTime(500); }); expect(Number(screen.getByTestId('header-tick').textContent)).toBe(tick);
    fireEvent.click(screen.getByRole('button', { name: '세계 목록' })); fireEvent.click(screen.getByRole('button', { name: '현재 관측 계속하기' })); expect(screen.getByRole('button', { name: '재생' })).toBeInTheDocument();
  });
  it('filters and selects existing events without fabricating or rewinding records', () => {
    const engine = new MockEngine(DEFAULT_CONFIG); const onEvent = vi.fn();
    render(<EventTimeline events={engine.getSnapshot().events} selectedEventId={null} onEvent={onEvent}/>);
    fireEvent.click(screen.getByRole('button', { name: '사망' })); expect(screen.getByText('이 유형의 사건은 아직 없습니다.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '탄생' })); fireEvent.click(screen.getByRole('button', { name: /초기 배치 · 50개체/ }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /초기 생명체 #050 배치/ }));
    expect(onEvent.mock.calls[0][0].creatureId).toBe(50); expect(engine.getSnapshot().tick).toBe(0);
  });
});
describe('P5: exceptional states and real persistence', () => {
  it('keeps deceased specimen data and prevents tracking a dead organism', () => {
    const engine = new MockEngine({ ...DEFAULT_CONFIG, population: 10 }); engine.getSnapshot().resources = []; engine.getSnapshot().creatures.forEach(c => c.energy = .001); const snapshot = engine.step();
    render(<CreatureInspector snapshot={snapshot} creature={snapshot.deceased[1]} tab="overview" setTab={vi.fn()} followId={null} onFollow={vi.fn()} onClose={vi.fn()} onClear={vi.fn()} onSelect={vi.fn()} sheetSize="full" onSheetSize={vi.fn()}/>);
    expect(screen.getByRole('status')).toHaveTextContent('사망'); expect(screen.getByText('#001')).toBeInTheDocument(); expect(screen.getByRole('button', { name: /이 개체 추적/ })).toBeDisabled();
  });
  it('shows storage failure and recovers gracefully from invalid stored data', () => {
    localStorage.setItem('genesis.world-configs.v1', '{invalid'); expect(loadWorldLibrary().error).not.toBe('');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Quota exceeded', 'QuotaExceededError'); });
    const result = saveWorldConfig(DEFAULT_CONFIG); expect(result.items).toEqual([]); expect(result.error).toContain('저장하지 못했습니다');
  });
});

describe('tutorial only appears for a newly created world', () => {
  it('still provides onboarding when creating a fresh world', () => {
    render(<App/>); createWorld();
    expect(screen.getByRole('button', { name: '튜토리얼 건너뛰기' })).toBeInTheDocument();
  });
  it('does not replay onboarding when opening a saved world configuration after reload', () => {
    saveWorldConfig(DEFAULT_CONFIG);
    render(<App/>);
    fireEvent.click(screen.getByRole('button', { name: /설정으로 다시 생성/ }));
    expect(screen.getByTestId('header-tick')).toHaveTextContent('000000');
    expect(screen.getByRole('button', { name: '재생' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '튜토리얼 건너뛰기' })).not.toBeInTheDocument();
  });
  it('does not replay an undismissed tutorial through either return route', () => {
    render(<App/>); createWorld();
    expect(screen.getByRole('button', { name: '튜토리얼 건너뛰기' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '세계 목록' }));
    fireEvent.click(screen.getByRole('button', { name: '현재 관측 계속하기' }));
    expect(screen.queryByRole('button', { name: '튜토리얼 건너뛰기' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '세계 목록' }));
    fireEvent.click(screen.getByRole('button', { name: '세계 관측소' }));
    expect(screen.queryByRole('button', { name: '튜토리얼 건너뛰기' })).not.toBeInTheDocument();
  });
});
