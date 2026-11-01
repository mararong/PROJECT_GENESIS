import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { EventKind, PrototypeEvent } from '../types/event';
import { EventTimeline } from '../components/timeline/EventTimeline';
import { summarizeTimeline } from '../components/timeline/summarizeTimeline';

function event(kind: EventKind, tick: number, id: number, message = kind + ' record ' + id): PrototypeEvent {
  return { id: kind + '-' + id, tick, kind, creatureId: id, message, x: id, y: 5 };
}

describe('timeline summaries preserve the model record', () => {
  it('shows births, deaths and extinction as important, with initial placement in one group', () => {
    const events = [event('birth', 0, 1), event('birth', 0, 2), event('eat', 2, 1), event('selection', 3, 1), event('death', 4, 2), event('extinction', 5, 3)];
    const copy = structuredClone(events);
    const groups = summarizeTimeline(events, 'important');
    expect(groups.map(group => group.kind)).toEqual(['extinction', 'death', 'birth']);
    expect(groups[2].label).toBe('초기 배치 · 2개체');
    expect(groups[2].events[0]).toBe(events[0]);
    expect(events).toEqual(copy);
  });
  it('groups repeated activity into 100-tick windows without losing source events', () => {
    const events = [event('eat', 5, 1), event('eat', 99, 2), event('eat', 100, 3), event('selection', 110, 4)];
    const groups = summarizeTimeline(events, 'eat');
    expect(groups).toHaveLength(2);
    expect(groups[0].firstTick).toBe(100);
    expect(groups[1].label).toBe('먹이 섭취 2회 · 2개체');
    expect(groups.flatMap(group => group.events)).toHaveLength(3);
    expect(summarizeTimeline(events, 'all').some(group => group.kind === 'selection')).toBe(true);
  });
  it('puts extinction before earlier same-tick records and does not mutate frozen input', () => {
    const death = Object.freeze(event('death', 100, 1));
    const extinction = Object.freeze(event('extinction', 100, 2));
    const groups = summarizeTimeline(Object.freeze([death, extinction]), 'important');
    expect(groups[0].events[0]).toBe(extinction);
    expect(groups[1].events[0]).toBe(death);
  });
  it('keeps demo reproduction clearly labelled in birth summaries', () => {
    const groups = summarizeTimeline([event('birth', 300, 10, '데모 번식 · #1 → #10'), event('birth', 301, 11, '데모 번식 · #2 → #11')], 'important');
    expect(groups[0].label).toBe('데모 번식 · 2개체 탄생');
  });
});

describe('quiet, inspectable event timeline', () => {
  it('starts with important events and hides routine feeding and selection records', () => {
    render(<EventTimeline events={[event('birth', 0, 1), event('eat', 10, 1, '일상 섭취 기록'), event('selection', 11, 1, '개체 선택 기록'), event('death', 20, 2, '중요 사망 기록')]} selectedEventId={null} onEvent={vi.fn()}/>);
    expect(screen.getByRole('button', { name: '주요' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('중요 사망 기록')).toBeInTheDocument();
    expect(screen.queryByText('일상 섭취 기록')).not.toBeInTheDocument();
    expect(screen.queryByText('개체 선택 기록')).not.toBeInTheDocument();
  });
  it('opens a placement summary and selects the exact original record, never an arbitrary specimen', () => {
    const first = event('birth', 0, 1, '첫 번째 개체 배치'), second = event('birth', 0, 2, '두 번째 개체 배치'), select = vi.fn();
    render(<EventTimeline events={[first, second]} selectedEventId={null} onEvent={select}/>);
    fireEvent.click(screen.getByRole('button', { name: /초기 배치 · 2개체/ }));
    expect(select).not.toHaveBeenCalled();
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: /두 번째 개체 배치/ }));
    expect(select).toHaveBeenCalledWith(second);
    expect(select.mock.calls[0][0]).toBe(second);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('keeps all repeated records accessible through paginated details', () => {
    const events = Array.from({ length: 81 }, (_, id) => event('eat', id, id, '섭취 기록 ' + id));
    const select = vi.fn();
    render(<EventTimeline events={events} selectedEventId={null} onEvent={select}/>);
    fireEvent.click(screen.getByRole('button', { name: '섭취' }));
    fireEvent.click(screen.getByRole('button', { name: /먹이 섭취 81회/ }));
    const list = screen.getByLabelText('묶음의 개별 기록');
    expect(within(list).getAllByRole('button')).toHaveLength(40);
    fireEvent.click(screen.getByRole('button', { name: /기록 더 보기/ }));
    expect(within(list).getAllByRole('button')).toHaveLength(80);
    fireEvent.click(screen.getByRole('button', { name: /기록 더 보기/ }));
    expect(within(list).getAllByRole('button')).toHaveLength(81);
    fireEvent.click(within(list).getByRole('button', { name: /섭취 기록 0$/ }));
    expect(select).toHaveBeenCalledWith(events[0]);
  });
  it('closes grouped details with Escape and restores focus to its summary', () => {
    render(<EventTimeline events={[event('birth', 0, 1), event('birth', 0, 2)]} selectedEventId={null} onEvent={vi.fn()}/>);
    const summary = screen.getByRole('button', { name: /초기 배치 · 2개체/ });
    summary.focus(); fireEvent.click(summary);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(summary);
  });
});
