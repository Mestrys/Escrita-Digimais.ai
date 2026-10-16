import { describe, expect, it } from 'vitest';
import { DEFAULT_PROFILE } from '../config/language-profile';
import { reviewText } from '../domain/review';
import type { ReviewContext } from '../domain/risks';
import { COMMUNICATION_TYPES } from '../domain/types';
import { gen } from './helpers';

const ctx: ReviewContext = { type: 'progress_update', recipient: 'user', techLevel: 'balanced' };
const codesOf = (text: string): string[] => reviewText(text, ctx, DEFAULT_PROFILE).warnings.map((w) => w.code);

describe('alerta de tom condescendente', () => {
  it.each([
    'Todo mundo sabe que é preciso reiniciar antes.',
    'Como qualquer um sabe, o cache deve ser limpo.',
    'Qualquer usuário consegue fazer isso.',
    'É só clicar no botão e pronto.',
    'Simplesmente reinicie o computador.',
    'Basta clicar em Atualizar.',
    'Até uma criança faria isso.',
  ])('alerta: %s', (text) => {
    expect(codesOf(text)).toContain('condescending_tone');
  });

  it.each([
    'Para resolver, reinicie o computador e informe se o erro persiste.',
    'O procedimento leva cerca de 2 minutos.',
    'Não basta reiniciar: precisamos também validar a atualização.',
    'Sabemos que o processo pode parecer extenso e agradecemos a paciência.',
    'Pedimos que clique em Atualizar e informe o resultado.',
    // Frases neutras que a primeira versão marcava por engano (a revisão de código reproduziu todas).
    'Pode só reiniciar o equipamento.',
    'Não é difícil identificar o erro nos logs.',
  ])('não alerta: %s', (text) => {
    expect(codesOf(text)).not.toContain('condescending_tone');
  });

  it('é aviso de cordialidade e traz sugestão acionável', () => {
    const w = reviewText('É só clicar no botão.', ctx, DEFAULT_PROFILE).warnings.find((x) => x.code === 'condescending_tone');
    expect(w?.severity).toBe('warning');
    expect(w?.dimension).toBe('cordiality');
    expect(w?.suggestion).toMatch(/neutra/);
    expect(w?.excerpt).toBeTruthy();
  });
});

describe('alerta de linguagem de pressão', () => {
  it.each([
    'Você tem que enviar o arquivo hoje.',
    'É sua obrigação manter o equipamento atualizado.',
    'Exigimos o retorno com os dados.',
    'Determinamos que o acesso seja devolvido.',
    'Envie obrigatoriamente o comprovante.',
    'Não aceitamos solicitações sem justificativa.',
    'Sob nenhuma hipótese compartilhe o acesso.',
    'Responda sem demora.',
    'Isso precisa ser feito a qualquer custo.',
  ])('alerta: %s', (text) => {
    expect(codesOf(text)).toContain('pressure_language');
  });

  it.each([
    'Por favor, envie o arquivo para continuarmos a análise.',
    'Para darmos andamento, precisamos do comprovante.',
    'Agradecemos o retorno com os dados solicitados.',
    'O prazo informado para retorno é 20/10.',
    'A solicitação foi recebida e está em análise.',
    'Por favor, altere a senha imediatamente.',
    'A senha foi redefinida imediatamente.',
    'Precisamos disso de imediato.',
    'O acesso foi restabelecido imediatamente após o reinício.',
  ])('não alerta: %s', (text) => {
    expect(codesOf(text)).not.toContain('pressure_language');
  });

  it('palavra registrada pelo analista no campo de prazo não gera alerta de pressão nem de promessa', () => {
    const withDeadline = (explicitDeadline: string): ReviewContext => ({ ...ctx, explicitDeadline });
    const pressure = 'Prazo informado: sem demora.';
    expect(codesOf(pressure)).toContain('pressure_language');
    expect(reviewText(pressure, withDeadline('sem demora'), DEFAULT_PROFILE).warnings.map((w) => w.code)).not.toContain('pressure_language');

    const promise = 'Prazo informado: ficará pronto até sexta-feira.';
    expect(codesOf(promise)).toContain('unfounded_promise');
    expect(reviewText(promise, withDeadline('ficará pronto até sexta-feira'), DEFAULT_PROFILE).warnings.map((w) => w.code)).not.toContain('unfounded_promise');
  });

  it('a isenção do prazo vale só para a palavra registrada: o resto do texto continua sendo revisado', () => {
    const text = 'Prazo informado: sem demora. Você tem que enviar o arquivo.';
    const found = reviewText(text, { ...ctx, explicitDeadline: 'sem demora' }, DEFAULT_PROFILE).warnings.map((w) => w.code);
    expect(found).toContain('pressure_language');
  });

  it('o texto do analista nunca é alterado pela revisão', () => {
    const original = 'Você tem que enviar o arquivo hoje.';
    const r = reviewText(original, ctx, DEFAULT_PROFILE);
    expect(r.warnings.some((w) => w.code === 'pressure_language')).toBe(true);
    expect(original).toBe('Você tem que enviar o arquivo hoje.');
  });
});

describe('os templates padrão não disparam os alertas de tom', () => {
  const FULL_CONTEXT = {
    summary: 'Erro ao abrir a planilha de custos.',
    questions: ['Qual mensagem de erro aparece na tela'],
    actions: ['Validadas as permissões do usuário'],
    observedResult: 'O erro persiste.',
    pendingItem: 'Retorno do usuário com a captura de tela.',
    expectedAction: 'Enviar a captura de tela do erro.',
    approvalObject: 'Instalação do software de planilhas.',
    approvalEffect: 'O usuário poderá abrir o arquivo.',
    destinationTeam: 'Equipe de Infraestrutura',
    escalationReason: 'A análise exige acesso administrativo.',
    freeIntent: 'O atendimento presencial foi agendado',
  };

  it('nenhuma combinação de tipo, formalidade e tamanho gera os códigos de tom', () => {
    const profile = { ...DEFAULT_PROFILE, closureRules: { ...DEFAULT_PROFILE.closureRules, noResponseEnabled: true } };
    let generated = 0;
    for (const type of COMMUNICATION_TYPES) {
      for (const formality of ['cordial', 'formal', 'direct'] as const) {
        for (const length of ['short', 'standard', 'detailed'] as const) {
          const r = gen(type, { ...FULL_CONTEXT, userConfirmation: 'yes', contactAttempts: ['10/10/2026', '12/10/2026', '14/10/2026'], priorNotice: '08/10/2026' } as never, { formality, length, recipient: type === 'technical_note' ? 'technical_team' : 'user' }, profile);
          if (r.blocked) continue;
          generated += 1;
          const found = r.warnings.map((w) => w.code);
          expect(found, `${type}/${formality}/${length}`).not.toContain('condescending_tone');
          expect(found, `${type}/${formality}/${length}`).not.toContain('pressure_language');
        }
      }
    }
    expect(generated).toBeGreaterThan(40);
  });
});
