import type { ChangeEvent } from 'react';
import type { FieldMeta } from '../../config/fields';

export type Requirement = 'required' | 'oneOf' | 'recommended' | undefined;

const REQ_TEXT: Record<Exclude<Requirement, undefined>, string> = {
  required: '(obrigatório)',
  oneOf: '(preencha ao menos um dos campos de ação, resultado ou pendência)',
  recommended: '(recomendado)',
};

interface Props {
  name: string;
  label: string;
  hint?: string;
  meta: FieldMeta;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  requirement?: Requirement;
  warning?: string;
}

export function FieldControl({ name, label, hint, meta, value, onChange, error, requirement, warning }: Props) {
  const id = `field-${name}`;
  const describedBy = [hint ? `${id}-hint` : '', error ? `${id}-error` : '', warning ? `${id}-warn` : '']
    .filter(Boolean)
    .join(' ');
  const common = {
    id,
    name,
    value,
    autoComplete: 'off',
    spellCheck: true,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': describedBy || undefined,
    'aria-required': requirement === 'required' ? true : undefined,
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(e.target.value),
  } as const;
  return (
    <div className="field">
      <label htmlFor={id}>
        {label} {requirement && <span className="badge">{REQ_TEXT[requirement]}</span>}
      </label>
      {hint && (
        <span id={`${id}-hint`} className="subtle">
          {hint}
        </span>
      )}
      {meta.kind === 'textarea' ? (
        <textarea {...common} rows={meta.rows ?? 3} />
      ) : (
        <input {...common} type="text" />
      )}
      {warning && (
        <p id={`${id}-warn`} className="subtle">
          {warning}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="error-text">
          {error}
        </p>
      )}
    </div>
  );
}
