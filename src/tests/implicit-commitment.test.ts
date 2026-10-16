import { describe, expect, it } from 'vitest';
import { DEFAULT_PROFILE } from '../config/language-profile';
import { reviewText } from '../domain/review';
import type { ReviewContext } from '../domain/risks';
import { COMMUNICATION_TYPES } from '../domain/types';
import { gen } from './helpers';

const ctx: ReviewContext = { type: 'progress_update', recipient: 'user', techLevel: 'balanced' };
const codesOf = (text: string): string[] => reviewText(text, ctx, DEFAULT_PROFILE).warnings.map((w) => w.code);

describe('alerta de compromisso implícito', () => {
  it.each([
    'Vamos resolver isso para você.',
    'Vamos corrigir a falha na próxima atualização.',
    'Com o ajuste, vai voltar ao normal.',
    'Depois disso vai funcionar.',
    'Tudo vai ficar resolvido em seguida.',
    'Esse erro não vai acontecer novamente.',
    'Isso nunca mais ocorre.',
    'A falha não se repetirá.',
    'Fique tranquilo, estamos cuidando.',
    'Pode ficar tranquila.',
    'A mudança será feita sem impacto para a equipe.',
    'Ação sem risco para os dados.',
    'A correção é sem custo adicional.',
    'Não haverá novos problemas após o ajuste.',
    'Não haverá indisponibilidade.',
    'O chamado será priorizado.',
    'O caso terá prioridade máxima.',
    'Seu pedido será tratado com prioridade.',
  ])('alerta: %s', (text) => {
    expect(codesOf(text)).toContain('implicit_commitment');
  });

  it.each([
    'Vamos continuar a análise com as informações enviadas.',
    'O serviço voltou a funcionar após o reinício.',
    'Seguimos com a análise e informaremos o próximo passo.',
    'Não foi possível reproduzir o erro até o momento.',
    'Registramos o impacto informado pelo usuário.',
    'O chamado foi classificado com prioridade média, conforme o registro.',
    'Aguardamos a conclusão do item acima para seguirmos com o atendimento.',
    'O risco informado pelo usuário foi registrado.',
  ])('não alerta: %s', (text) => {
    expect(codesOf(text)).not.toContain('implicit_commitment');
  });

  it('é aviso de segurança com sugestão e trecho', () => {
    const w = reviewText('Fique tranquilo, vamos resolver.', ctx, DEFAULT_PROFILE).warnings.find((x) => x.code === 'implicit_commitment');
    expect(w?.severity).toBe('warning');
    expect(w?.dimension).toBe('safety');
    expect(w?.suggestion).toMatch(/próximo passo concreto/);
    expect(w?.excerpt).toBeTruthy();
  });

  it('convive com a regra de promessa de resultado, sem substituí-la', () => {
    const found = codesOf('Garantimos que vamos resolver ainda hoje.');
    expect(found).toContain('unfounded_promise');
    expect(found).toContain('implicit_commitment');
  });

  it('os templates padrão não disparam o alerta', () => {
    const profile = { ...DEFAULT_PROFILE, closureRules: { ...DEFAULT_PROFILE.closureRules, noResponseEnabled: true } };
    const context = {
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
      userConfirmation: 'yes',
      contactAttempts: ['10/10/2026', '12/10/2026', '14/10/2026'],
      priorNotice: '08/10/2026',
    };
    let generated = 0;
    for (const type of COMMUNICATION_TYPES) {
      for (const formality of ['cordial', 'formal', 'direct'] as const) {
        for (const variant of [0, 1]) {
          const r = gen(type, context as never, { formality, variant, recipient: type === 'technical_note' ? 'technical_team' : 'user' }, profile);
          if (r.blocked) continue;
          generated += 1;
          expect(r.warnings.map((w) => w.code), `${type}/${formality}/v${variant}`).not.toContain('implicit_commitment');
        }
      }
    }
    expect(generated).toBeGreaterThan(20);
  });
});
