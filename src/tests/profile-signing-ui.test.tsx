import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { exportProfileJson } from '../config/profile-schema';
import { AppStorage } from '../infrastructure/storage';
import { App } from '../ui/App';
import { MemoryArea } from './memory-storage';
import { NOW } from './helpers';
import { closeSigningDir, keygen, normalized, signWith } from './signing-helpers';

afterEach(() => cleanup());
afterAll(closeSigningDir);

describe('importação com assinatura obrigatória', () => {
  it('recusa perfil simples, aceita o assinado e o mantém ao reabrir', async () => {
    const keys = keygen('ui');
    const local = new MemoryArea();
    const store = () => new AppStorage(local, new MemoryArea());
    const user = userEvent.setup();
    const view = render(<App storage={store()} now={() => NOW} loadKeys={async () => [keys.publicKey]} />);

    await user.click(await screen.findByRole('button', { name: 'Configurações' }));
    expect(screen.getByText(/exige perfil assinado/)).toBeInTheDocument();
    const input = screen.getByLabelText('Importar perfil (JSON)');

    await user.upload(input, new File([exportProfileJson(normalized('Sem Assinatura'))], 'p.json', { type: 'application/json' }));
    expect(await screen.findByText(/Importação recusada/)).toBeInTheDocument();
    expect(local.data.languageProfile).toBeUndefined();

    const signed = JSON.stringify(signWith(keys, normalized('Org Assinada UI')));
    await user.upload(input, new File([signed], 'p.assinado.json', { type: 'application/json' }));
    expect(await screen.findByText('Perfil importado e validado.')).toBeInTheDocument();
    expect(screen.getByText('Org Assinada UI')).toBeInTheDocument();

    view.unmount();
    render(<App storage={store()} now={() => NOW} loadKeys={async () => [keys.publicKey]} />);
    await user.click(await screen.findByRole('button', { name: 'Configurações' }));
    expect(await screen.findByText('Org Assinada UI')).toBeInTheDocument();
  });

  it('perfil guardado deixa de valer quando a chave da política muda', async () => {
    const keys = keygen('ui-a');
    const other = keygen('ui-b');
    const profile = normalized('Org Antiga');
    const local = new MemoryArea();
    await new AppStorage(local, null).saveProfile(profile, signWith(keys, profile).signatureValue);
    const user = userEvent.setup();
    render(<App storage={new AppStorage(local, new MemoryArea())} now={() => NOW} loadKeys={async () => [other.publicKey]} />);
    await user.click(await screen.findByRole('button', { name: 'Configurações' }));
    expect(await screen.findByText(/padrão da extensão/)).toBeInTheDocument();
    expect(screen.queryByText('Org Antiga')).not.toBeInTheDocument();
  });
});
