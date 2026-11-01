import { useMemo, useState } from 'react';
import { Circle, MousePointer2, Skull, Sprout, Utensils } from 'lucide-react';
import type { PrototypeEvent } from '../../types/event';
import { Modal } from '../Modal';
import { formatEventTicks, summarizeTimeline } from './summarizeTimeline';
import type { TimelineFilter } from './summarizeTimeline';

const EVENT_UI = {
  birth: { label: '배치·탄생', Icon: Sprout },
  eat: { label: '섭취', Icon: Utensils },
  death: { label: '사망', Icon: Skull },
  selection: { label: '선택', Icon: MousePointer2 },
  extinction: { label: '멸종', Icon: Circle },
  reproduction: { label: '번식', Icon: Sprout },
  resource_low: { label: '자원 부족', Icon: Utensils },
  resource_recovered: { label: '자원 회복', Icon: Sprout },
};
const FILTERS = [
  { id: 'important', label: '주요' }, { id: 'all', label: '전체' },
  { id: 'birth', label: '탄생' }, { id: 'death', label: '사망' }, { id: 'eat', label: '섭취' },
  { id: 'reproduction', label: '번식' },
] as const;

export function EventTimeline({ events, selectedEventId, onEvent }: {
  events: PrototypeEvent[]; selectedEventId: string | null; onEvent: (event: PrototypeEvent) => void;
}) {
  const [filter, setFilter] = useState<TimelineFilter>('important');
  const [limit, setLimit] = useState(40);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailLimit, setDetailLimit] = useState(40);
  const groups = useMemo(() => summarizeTimeline(events, filter), [events, filter]);
  const expanded = groups.find(group => group.id === expandedId);
  const displayedCount = groups.reduce((sum, group) => sum + group.events.length, 0);

  return <div className="timeline-content">
    <div className="timeline-heading">
      <div className="section-label">사건 타임라인 <small>표시 {groups.length}개 · 원본 {displayedCount}건</small></div>
      <div className="event-filters" aria-label="사건 필터">{FILTERS.map(item =>
        <button key={item.id} aria-pressed={filter === item.id} className={filter === item.id ? 'active' : ''}
          onClick={() => { setFilter(item.id); setLimit(40); setExpandedId(null); }}>{item.label}</button>
      )}</div>
    </div>
    <div className="event-track" aria-label="기록된 사건">
      {groups.length === 0 ? <p className="muted">{filter === 'important' ? '아직 주요 사건이 없습니다. 반복 활동은 전체·섭취에서 확인할 수 있습니다.' : '이 유형의 사건은 아직 없습니다.'}</p> :
        groups.slice(0, limit).map(group => {
          const { Icon, label } = EVENT_UI[group.kind];
          const isGroup = group.events.length > 1;
          const selected = group.events.some(event => event.id === selectedEventId);
          return <button key={group.id} className={'event-card event-' + group.kind + (selected ? ' selected' : '')}
            data-event-count={group.events.length}
            aria-haspopup={isGroup ? 'dialog' : undefined}
            onClick={() => {
              if (isGroup) { setExpandedId(group.id); setDetailLimit(40); }
              else onEvent(group.events[0]);
            }}
            title={isGroup ? group.label + ' · 개별 기록 보기' : group.label + ' · 발생 시점으로 되감지는 않습니다.'}>
            <span className="event-icon"><Icon size={15}/></span>
            <span><small className="mono">{formatEventTicks(group)} <b>{label}</b>{isGroup && <i className="event-group-count">{group.events.length}건 묶음</i>}</small>
              <strong>{group.label}</strong></span>
          </button>;
        })}
      {groups.length > limit && <button className="load-events" onClick={() => setLimit(count => count + 40)}>이전 사건 더 보기<br/>+{groups.length - limit}</button>}
    </div>
    {expanded && <Modal title={EVENT_UI[expanded.kind].label + ' · ' + expanded.events.length + '건'} onClose={() => setExpandedId(null)}>
      <div className="event-detail-body">
        <p className="muted">{formatEventTicks(expanded)} · {expanded.label}</p>
        <p className="event-detail-note">개별 기록을 선택하면 해당 개체와 위치를 강조합니다. 시간은 되감지 않습니다.</p>
        <div className="event-detail-list" aria-label="묶음의 개별 기록">
          {[...expanded.events].reverse().slice(0, detailLimit).map(event => <button key={event.id}
            className={'event-detail-row' + (event.id === selectedEventId ? ' selected' : '')}
            data-event-id={event.id} data-creature-id={event.creatureId ?? ''}
            onClick={() => { onEvent(event); setExpandedId(null); }}>
            <span className="mono">T{String(event.tick).padStart(5, '0')}</span><span>{event.message}</span>
          </button>)}
        </div>
        {expanded.events.length > detailLimit && <button className="event-detail-more" onClick={() => setDetailLimit(count => count + 40)}>기록 더 보기 · {expanded.events.length - detailLimit}건 남음</button>}
      </div>
    </Modal>}
  </div>;
}
