import { fieldLabel } from '../../config/fields';
import { CATEGORY_LABELS, maskedContext } from '../../domain/sensitive';
import type { CommunicationType, ContextField, SensitiveFinding } from '../../domain/types';

interface Props {
  type: CommunicationType;
  values: Partial<Record<ContextField, string>>;
  findings: SensitiveFinding[];
  onMask: (finding: SensitiveFinding) => void;
  undoLabel?: string;
  onUndo: () => void;
}

/** Mostra possíveis dados sensíveis com trecho mascarado. Nunca exibe o valor original. */
export function SensitivePanel({ type, values, findings, onMask, undoLabel, onUndo }: Props) {
  if (findings.length === 0 && !undoLabel) return null;
  const blocking = findings.some((f) => f.blocking);
  return (
    <section className={`panel ${blocking ? 'block' : 'warn'}`} aria-labelledby="sensitive-title">
      <h2 id="sensitive-title">Possíveis dados sensíveis ({findings.length})</h2>
      <p className="subtle">
        Detecção local e conservadora. Pode haver falsos positivos e falsos negativos. Os campos originais não são
        alterados sem a sua ação.
      </p>
      {blocking && (
        <p className="error-text">Credenciais, tokens e chaves impedem a geração do texto até serem removidos.</p>
      )}
      <ul className="list">
        {findings.map((f, i) => {
          const text = (f.field && values[f.field]) || '';
          const ctx = maskedContext(text, f, findings);
          const where = f.field ? fieldLabel(f.field, type) : 'campo';
          return (
            <li key={`${f.field}-${f.start}-${i}`}>
              <span className={`tag ${f.blocking ? 'block' : 'warning'}`}>{f.blocking ? 'Bloqueio' : 'Alerta'}</span>
              <strong>{CATEGORY_LABELS[f.category]}</strong> em “{where}”
              <p>
                <code className="ctx">
                  {f.replaceable ? ctx.before : ''}
                  <mark>{f.maskedExcerpt}</mark>
                  {f.replaceable ? ctx.after : ''}
                </code>
              </p>
              <p className="subtle">Motivo: {f.reason}</p>
              <p className="subtle">Ação recomendada: {f.action}</p>
              {f.replaceable && (
                <button
                  type="button"
                  onClick={() => onMask(f)}
                  aria-label={`Substituir por marcador de omissão: ${CATEGORY_LABELS[f.category]} em ${where}`}
                >
                  Substituir por {f.placeholder}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {undoLabel && (
        <p>
          {undoLabel}{' '}
          <button type="button" onClick={onUndo}>
            Desfazer
          </button>
        </p>
      )}
    </section>
  );
}
