import { describe, expect, it } from 'vitest';
import { profileWith, codes, gen } from './helpers';
import { dedupeChanges, startsWithTeamVerb, toTeamVoice } from '../domain/voice';
import { greetingName } from '../domain/planner';

describe('voz da equipe (lista fechada)', () => {
  it('converte pretérito, particípio inicial, futuro e possessivos conhecidos', () => {
    expect(toTeamVoice('resetei a senha').text).toBe('resetamos a senha');
    expect(toTeamVoice('Reinstalado o driver').text).toBe('Reinstalamos o driver');
    expect(toTeamVoice('vou validar amanhã').text).toBe('vamos validar amanhã');
    expect(toTeamVoice('conexão ok no meu teste').text).toBe('conexão ok no nosso teste');
  });

  it('não toca em palavras fora das listas nem em partes de palavras', () => {
    const original = 'Reinstalação do driver; o usuário relatou lentidão';
    expect(toTeamVoice(original)).toEqual({ text: original, changes: [] });
    expect(toTeamVoice('o meuble e a minhoca').changes).toEqual([]);
  });

  it('particípio só vale no início da frase', () => {
    expect(toTeamVoice('driver reinstalado ontem').text).toBe('driver reinstalado ontem');
  });

  it('registra o que mudou sem duplicar', () => {
    const { changes } = toTeamVoice('testei, testei e testei');
    expect(dedupeChanges(changes)).toEqual([{ from: 'testei', to: 'testamos' }]);
  });

  it('reconhece verbo da equipe no início', () => {
    expect(startsWithTeamVerb('Resetamos a senha')).toBe(true);
    expect(startsWithTeamVerb('Resetei a senha')).toBe(false);
  });
});

describe('estilo natural', () => {
  const ctx = {
    summary: 'usuário sem acesso à VPN desde ontem',
    actions: ['resetei a senha no AD', 'testei conexão com a conta dele', 'Planejado: validar com o usuário amanhã'],
    observedResult: 'conexão ok no meu teste',
    pendingItem: 'aguardando teste do usuário',
  };

  it('fala em nome da equipe, em frases corridas, e avisa do ajuste', () => {
    const r = gen('progress_update', ctx, { techLevel: 'simple' });
    expect(r.blocked).toBe(false);
    expect(r.text).toContain('Até aqui, resetamos a senha no AD e testamos conexão com a conta dele.');
    expect(r.text).toContain('Em seguida, vamos validar com o usuário amanhã.');
    expect(r.text).toContain('nosso teste');
    expect(r.text).not.toMatch(/\bresetei\b|\bmeu\b/i);
    const w = r.warnings.find((x) => x.code === 'voice_adjusted');
    expect(w?.severity).toBe('info');
    expect(w?.message).toContain('"resetei" para "resetamos"');
    expect(r.quality.clarity).toBeGreaterThanOrEqual(90);
  });

  it('o estilo estruturado preserva exatamente a redação anterior', () => {
    const r = gen('progress_update', ctx, { techLevel: 'simple', style: 'structured' });
    expect(r.text).toContain('O que foi feito:\n1. Resetei a senha no AD.');
    expect(codes(r)).not.toContain('voice_adjusted');
  });

  it('cai na lista numerada quando alguma ação não começa com verbo reconhecido', () => {
    const r = gen('progress_update', { ...ctx, actions: ['resetei a senha', 'Limpeza do cache'] });
    expect(r.text).toMatch(/\n1\. Resetamos a senha\.\n2\. Limpeza do cache\./);
  });

  it('mais de três ações viram lista', () => {
    const r = gen('progress_update', { ...ctx, actions: ['resetei a', 'testei b', 'limpei c', 'validei d'] });
    expect(r.text).toContain('1. Resetamos a.');
  });

  it('frases de ligação variam com a variação e não vazam rótulos secos', () => {
    const a = gen('progress_update', ctx, { variant: 0 }).text;
    const b = gen('progress_update', ctx, { variant: 1 }).text;
    expect(a).not.toBe(b);
    expect(a).not.toContain('Ações realizadas');
  });

  it('textos internos (nota técnica) e destinatário técnico mantêm a redação estruturada', () => {
    const r = gen('technical_note', { actions: ['resetei a senha'], observedResult: 'ok' }, { recipient: 'technical_team' });
    expect(r.text).toContain('Ações realizadas: Resetei a senha.');
    const t = gen('progress_update', ctx, { recipient: 'technical_team' });
    expect(t.text).toContain('Resetei a senha');
  });

  it('rótulos próprios da organização desligam o estilo natural', () => {
    const profile = profileWith({ templates: { labels: { simple: { actions_done: 'Procedimentos' } } } });
    const r = gen('progress_update', ctx, { techLevel: 'simple' }, profile);
    expect(r.text).toContain('Procedimentos:');
    expect(r.text).toContain('Resetei a senha');
  });

  it('pedido de informação: pede com frase de ligação e mantém as perguntas intactas', () => {
    const r = gen('request_information', { summary: 'erro no sistema', questions: ['qual a mensagem do erro', 'quando começou'] });
    expect(r.text).toContain('Para avançarmos, precisamos saber:');
    expect(r.text).toContain('1. Qual a mensagem do erro?');
  });
});

describe('saudação com nome', () => {
  const ctx = { pendingItem: 'envio do arquivo', expectedAction: 'enviar o arquivo atualizado', requesterName: 'maria souza' };

  it('usa só o primeiro nome, nas três formalidades', () => {
    expect(gen('pending', ctx, { formality: 'cordial' }).text.startsWith('Olá, Maria,')).toBe(true);
    expect(gen('pending', ctx, { formality: 'direct' }).text.startsWith('Olá, Maria,')).toBe(true);
    expect(gen('pending', ctx, { formality: 'formal' }).text.startsWith('Prezado(a) Maria,')).toBe(true);
  });

  it('ignora nome com formato suspeito e mantém a saudação do perfil', () => {
    expect(greetingName('João')).toBe('João');
    expect(greetingName('x@y.com')).toBeUndefined();
    expect(greetingName('<b>Maria</b>')).toBeUndefined();
    expect(greetingName('   ')).toBeUndefined();
    const r = gen('pending', { ...ctx, requesterName: 'Ma{ria}' });
    expect(r.text.startsWith('Olá,\n')).toBe(true);
  });

  it('saudação personalizada do perfil não é alterada', () => {
    const profile = profileWith({
      greetings: { ...profileWith({}).greetings, cordial: { ...profileWith({}).greetings.cordial, user: 'Bom dia,' } },
    });
    expect(gen('pending', ctx, {}, profile).text.startsWith('Bom dia,\n')).toBe(true);
  });

  it('estilo estruturado não usa o nome', () => {
    expect(gen('pending', ctx, { style: 'structured' }).text.startsWith('Olá,\n')).toBe(true);
  });

  it('o nome passa pela varredura de dados sensíveis', () => {
    const r = gen('pending', { ...ctx, requesterName: 'maria@empresa.com' });
    expect(r.sensitiveFindings.some((f) => f.field === 'requesterName')).toBe(true);
  });
});

describe('detalhes de naturalidade', () => {
  it('particípio no feminino e no plural também vira voz da equipe', () => {
    expect(toTeamVoice('Validadas as permissões do usuário').text).toBe('Validamos as permissões do usuário');
    expect(toTeamVoice('Reiniciados os serviços').text).toBe('Reiniciamos os serviços');
  });

  it('não escreve "Pendente com: usuário" para o próprio usuário, mas mantém para o gestor', () => {
    const c = { pendingItem: 'envio do arquivo', expectedAction: 'enviar o arquivo' };
    expect(gen('pending', c, { recipient: 'user' }).text).not.toContain('Pendente com');
    expect(gen('pending', c, { recipient: 'manager' }).text).toContain('Pendente com: gestor');
    expect(gen('pending', c, { recipient: 'user', style: 'structured' }).text).toContain('Pendente com: usuário');
  });
});
