import { useState } from 'react';
import { openSidePanel } from '../infrastructure/extension';

export function Popup({ open = openSidePanel }: { open?: () => Promise<boolean> }) {
  const [failed, setFailed] = useState(false);
  const onOpen = async (): Promise<void> => {
    const ok = await open();
    if (ok) window.close();
    else setFailed(true);
  };
  return (
    <main>
      <h1>Assistente de Textos do Service Desk</h1>
      <p className="subtle">Funciona localmente. Nenhum conteúdo é enviado ou salvo.</p>
      <button type="button" className="primary" onClick={() => void onOpen()}>
        Abrir painel lateral
      </button>
      {failed && (
        <p role="alert" className="error-text">
          Não foi possível abrir o painel. Use o menu de painéis laterais do navegador.
        </p>
      )}
    </main>
  );
}
