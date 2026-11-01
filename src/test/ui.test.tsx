import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { CreateWorldDialog } from '../features/world/CreateWorldDialog';
import { CreatureInspector } from '../components/inspector/CreatureInspector';
import { BottomControlBar } from '../components/layout/BottomControlBar';
import { EventTimeline } from '../components/timeline/EventTimeline';
import { generateWorld, DEFAULT_CONFIG } from '../simulation/worldGenerator.ts';

// jsdom supplies the DOM but not the native dialog showModal/close methods.
HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','')};
HTMLDialogElement.prototype.close=function(){this.removeAttribute('open')};
afterEach(cleanup);
beforeEach(() => { vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null); });
afterEach(() => vi.restoreAllMocks());
describe('세계 생성 마법사',()=>{
  it('validates numeric inputs and creates exactly the entered configuration',()=>{
    const create=vi.fn();render(<CreateWorldDialog onClose={vi.fn()} onCreate={create}/>);
    fireEvent.change(screen.getByLabelText('세계 이름'),{target:{value:'테스트 세계'}});
    fireEvent.change(screen.getByLabelText('난수 씨드'),{target:{value:'1234'}});
    fireEvent.change(screen.getByLabelText('맵 프리셋'),{target:{value:'forest'}});
    fireEvent.click(screen.getByRole('button',{name:'다음'}));
    const population=screen.getByLabelText(/시작 개체수/);
    fireEvent.change(population,{target:{value:'101'}});fireEvent.click(screen.getByRole('button',{name:'다음'}));
    expect(screen.getByRole('alert')).toHaveTextContent('10~100');expect(create).not.toHaveBeenCalled();
    fireEvent.change(population,{target:{value:'30'}});fireEvent.click(screen.getByRole('button',{name:'다음'}));
    fireEvent.click(screen.getByRole('button',{name:'이전'}));expect(screen.getByLabelText(/시작 개체수/)).toHaveValue(30);
    fireEvent.click(screen.getByRole('button',{name:'다음'}));fireEvent.click(screen.getByRole('button',{name:'세계 생성'}));
    expect(create).toHaveBeenCalledWith({name:'테스트 세계',seed:1234,preset:'forest',population:30,demoReproduction:false});
  });
  it('rejects empty and fractional seeds',()=>{render(<CreateWorldDialog onClose={vi.fn()} onCreate={vi.fn()}/>);for(const value of ['','1.5']){fireEvent.change(screen.getByLabelText('난수 씨드'),{target:{value}});fireEvent.click(screen.getByRole('button',{name:'다음'}));expect(screen.getByRole('alert')).toHaveTextContent('씨드');}});
});
describe('인스펙터와 시간 제어',()=>{
  it('renders the same selected ID, body parts and genome from the snapshot',()=>{
    const w=generateWorld(DEFAULT_CONFIG),c=w.creatures[12],setTab=vi.fn();
    const props={snapshot:w,creature:c,tab:'body' as const,setTab,followId:null,onFollow:vi.fn(),onClose:vi.fn(),onClear:vi.fn(),onSelect:vi.fn(),sheetSize:'medium' as const,onSheetSize:vi.fn()};
    const {rerender}=render(<CreatureInspector {...props}/>);
    expect(screen.getByText('#013')).toBeInTheDocument();expect(screen.getAllByRole('button').filter(b=>b.querySelector('.part-symbol')).length).toBe(c.bodyParts.length);
    rerender(<CreatureInspector {...props} tab="genome"/>);expect(screen.getByText(c.genome.moveSpeed.toFixed(3),{exact:false})).toBeInTheDocument();
    rerender(<CreatureInspector {...props} creature={{...c,currentAction:'dead',energy:0,health:0}} tab="overview"/>);
    expect(screen.getByRole('status')).toHaveTextContent('마지막 상태');expect(screen.getByRole('button',{name:/이 개체 추적/})).toBeDisabled();
  });
  it('single step is disabled while playing and speed buttons call their handler',()=>{
    const speed=vi.fn(),step=vi.fn(),toggle=vi.fn();const props={isPlaying:true,onToggle:toggle,onStep:step,speed:1,setSpeed:speed,tick:50,tickRate:10,extinct:false,timelineOpen:true,onTimeline:vi.fn()};
    const {rerender}=render(<BottomControlBar {...props}/>);expect(screen.getByRole('button',{name:'다음 틱'})).toBeDisabled();fireEvent.click(screen.getByRole('button',{name:'10배속'}));expect(speed).toHaveBeenCalledWith(10);
    rerender(<BottomControlBar {...props} isPlaying={false}/>);fireEvent.click(screen.getByRole('button',{name:'다음 틱'}));expect(step).toHaveBeenCalledTimes(1);
  });
  it('event filters keep source records and select the exact event',()=>{
    const event={id:'death-1',tick:200,kind:'death' as const,creatureId:7,message:'#007 에너지 고갈로 사망'},select=vi.fn();
    const events=[...generateWorld({...DEFAULT_CONFIG,population:10}).events,event];render(<EventTimeline events={events} selectedEventId={null} onEvent={select}/>);
    fireEvent.click(screen.getByRole('button',{name:'사망'}));fireEvent.click(screen.getByRole('button',{name:/#007 에너지 고갈/}));expect(select).toHaveBeenCalledWith(event);expect(events.length).toBe(11);
  });
});
