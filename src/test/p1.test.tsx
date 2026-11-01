import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Modal } from '../components/Modal';
import { TopBar } from '../components/layout/TopBar';
import { SideNav } from '../components/layout/SideNav';
describe('P1: accessible shell', () => {
  it('clearly identifies the prototype and hides world operations until a world exists', () => {
    render(<TopBar world={null} onHome={vi.fn()} onCreate={vi.fn()} onSave={vi.fn()} onPanel={vi.fn()} fullscreen={false} onFullscreen={vi.fn()}/>);
    expect(screen.getByText('M0 생태계 시뮬레이션')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '현재 세계 저장' })).not.toBeInTheDocument();
  });
  it('marks advanced analysis as unavailable and executes help', () => {
    const onHelp = vi.fn(); render(<SideNav viewingWorld={false} hasWorld={false} onHome={vi.fn()} onObserve={vi.fn()} onHistory={vi.fn()} onHelp={onHelp}/>);
    expect(screen.getByRole('button', { name: '두뇌 관찰실 준비 중' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: '개체 유전자 분석' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '도움말' })); expect(onHelp).toHaveBeenCalledOnce();
  });
  it('supports Escape and restores the opening focus after closing', () => {
    const onClose = vi.fn(), opener = document.createElement('button'); document.body.appendChild(opener); opener.focus();
    const { unmount } = render(<Modal title="세계 생성" onClose={onClose}><input aria-label="이름"/></Modal>);
    expect(screen.getByRole('dialog')).toHaveAccessibleName('세계 생성'); fireEvent.keyDown(document, { key: 'Escape' }); expect(onClose).toHaveBeenCalledOnce();
    unmount(); expect(document.activeElement).toBe(opener); opener.remove();
  });
});
