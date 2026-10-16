import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { exportProfileJson } from '../config/profile-schema';
import { DEFAULT_PROFILE } from '../config/language-profile';
import { AppStorage } from '../infrastructure/storage';
import { App } from '../ui/App';
import { MemoryArea } from './memory-storage';
import { NOW } from './helpers';

afterEach(() => cleanup());

const file = (obj: unknown) => new File([JSON.stringify(obj)], 'camada.json', { type: 'application/json' });

describe('camada da equipe na interface', () => {
  it('importa, mostra, persiste ao reabrir e remove', async () => {
    const local = new MemoryArea();
    const make = () => <App storage={new AppStorage(local, new MemoryArea())} now={() => NOW} />;
    const user = userEvent.setup();
    const view = render(make());
    await user.click(await screen.findByRole('button', { name: 'Configurações' }));
    expect(screen.getByText('Nenhuma camada ativa.')).toBeInTheDocument();

    await user.upload(screen.getByLabelText('Importar camada da equipe (JSON)'), file({ schemaVersion: 1, overlayName: 'Equipe Redes', forbiddenTerms: ['gambiarra'] }));
    expect(await screen.findByText('Camada da equipe importada e validada.')).toBeInTheDocument();
    expect(screen.getByText('Equipe Redes')).toBeInTheDocument();

    view.unmount();
    render(make());
    await user.click(await screen.findByRole('button', { name: 'Configurações' }));
    expect(await screen.findByText('Equipe Redes')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Remover camada da equipe' }));
    expect(await screen.findByText('Nenhuma camada ativa.')).toBeInTheDocument();
    expect(local.data.profileOverlay).toBeUndefined();
  });

  it('recusa camada que tenta mudar estilo e não grava nada', async () => {
    const local = new MemoryArea();
    const user = userEvent.setup();
    render(<App storage={new AppStorage(local, new MemoryArea())} now={() => NOW} />);
    await user.click(await screen.findByRole('button', { name: 'Configurações' }));
    await user.upload(screen.getByLabelText('Importar camada da equipe (JSON)'), file({ schemaVersion: 1, overlayName: 'X', signature: 'Fulano' }));
    expect(await screen.findByText(/Importação da camada recusada/)).toBeInTheDocument();
    expect(local.data.profileOverlay).toBeUndefined();
  });

  it('exportar perfil não inclui a camada e restaurar o perfil padrão preserva a camada', async () => {
    const local = new MemoryArea({ languageProfile: { ...DEFAULT_PROFILE, organizationName: 'Org' }, profileOverlay: { schemaVersion: 1, overlayName: 'Equipe', forbiddenTerms: ['macete'] } });
    const user = userEvent.setup();
    render(<App storage={new AppStorage(local, new MemoryArea())} now={() => NOW} />);
    await user.click(await screen.findByRole('button', { name: 'Configurações' }));
    await user.click(await screen.findByRole('button', { name: 'Restaurar perfil padrão' }));
    expect(await screen.findByText(/padrão da extensão/)).toBeInTheDocument();
    expect(screen.getByText('Equipe')).toBeInTheDocument();
    expect((local.data.profileOverlay as { overlayName: string }).overlayName).toBe('Equipe');
    expect(exportProfileJson(DEFAULT_PROFILE)).not.toContain('macete');
  });
});
