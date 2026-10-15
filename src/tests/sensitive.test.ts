import { describe, expect, it } from 'vitest';
import { applyMasking, maskedContext, scanText } from '../domain/sensitive';
import { isValidCnpj, isValidCpf, passesLuhn } from '../domain/validators';

const cats = (t: string, domains: string[] = []) => scanText(t, { internalDomains: domains }).map((f) => f.category);

describe('validadores', () => {
  it('CPF, CNPJ e Luhn fictícios', () => {
    expect(isValidCpf('529.982.247-25')).toBe(true);
    expect(isValidCpf('111.111.111-11')).toBe(false);
    expect(isValidCnpj('11.222.333/0001-81')).toBe(true);
    expect(isValidCnpj('11.222.333/0001-80')).toBe(false);
    expect(passesLuhn('4111 1111 1111 1111')).toBe(true);
    expect(passesLuhn('4111 1111 1111 1112')).toBe(false);
  });
});

describe('detecção bloqueante', () => {
  it.each([
    ['senha: Abc@12345', 'credential'],
    ['A senha é "tr0ub4dor"', 'credential'],
    ['password=hunter2x', 'credential'],
    ['Authorization: Bearer abcdefghijklmnopqrstuvwxyz123456', 'token'],
    ['eyJhbGciOiJIUzI1.eyJzdWIiOiIxMjM0NTY.SflKxwRJSMeKKF2QT4fw', 'token'],
    ['chave AKIAABCDEFGHIJKLMNOP', 'token'],
    ['api_key = a1b2c3d4e5f6g7h8', 'secret'],
    ['-----BEGIN RSA PRIVATE KEY-----\nMIIabc\n-----END RSA PRIVATE KEY-----', 'private_key'],
    ['Server=db;Database=x;User Id=a;Password=zzz123;', 'connection_string'],
    ['postgres://admin:s3cret@db.exemplo.test/app', 'connection_string'],
    ['https://exemplo.test/x?token=abcdef123456', 'token'],
  ])('bloqueia %s', (text, category) => {
    const f = scanText(text);
    expect(f.some((x) => x.blocking && x.category === category)).toBe(true);
  });

  it('nunca expõe o segredo no trecho mascarado', () => {
    const [f] = scanText('senha: SuperSecreta99');
    expect(f?.maskedExcerpt).not.toContain('Super');
    expect(f?.maskedExcerpt).toMatch(/caracteres/);
  });

  it('não confunde menção sem valor com credencial', () => {
    expect(scanText('O usuário esqueceu a senha e pediu redefinição.')).toEqual([]);
    expect(scanText('A senha é temporária.')).toEqual([]);
    expect(scanText('senha: expirada').filter((f) => f.blocking)).toEqual([]);
    expect(scanText('token expirado').filter((f) => f.blocking)).toEqual([]);
  });
});

describe('detecção de dados pessoais e infraestrutura', () => {
  it('detecta categorias não bloqueantes', () => {
    expect(cats('CPF 529.982.247-25')).toContain('cpf');
    expect(cats('CNPJ 11.222.333/0001-81')).toContain('cnpj');
    expect(cats('contato: ana.teste@exemplo.test')).toContain('email');
    expect(cats('ligar para (11) 91234-5678')).toContain('phone');
    expect(cats('Rua das Flores, 123')).toContain('address');
    expect(cats('CEP 01310-100')).toContain('address');
    expect(cats('cartão 4111 1111 1111 1111')).toContain('card');
    expect(cats('agência 1234 conta 56789-0')).toContain('bank');
    expect(cats('IP 10.20.30.40')).toContain('ip');
    expect(cats('servidor srv-fin-01 e dc01.corp')).toContain('hostname');
    expect(cats('abra http://intranet/portal')).toContain('url');
    expect(cats('abra https://wiki.empresa.test/x', ['empresa.test'])).toContain('url');
    expect(cats('C:\\Users\\ana\\Documentos\\a.xlsx')).toContain('path');
    expect(cats('\\\\fileserver\\publico')).toContain('path');
  });

  it('não sinaliza texto comum', () => {
    expect(cats('Erro 0x80070005 ao abrir a planilha no chamado INC0012345 em 15/10/2026.')).toEqual([]);
    expect(cats('Visite https://www.exemplo.test/ajuda')).toEqual([]);
    expect(cats('Versão 10.0.19045.1 instalada')).toEqual([]);
  });

  it('detecta bloco de log extenso', () => {
    const log = Array.from({ length: 10 }, (_, i) => `2026-10-15 10:0${i}:00 ERROR falha ${i}`).join('\n');
    const f = scanText(log);
    expect(f.some((x) => x.category === 'log_block' && !x.blocking && !x.replaceable)).toBe(true);
  });

  it('mascara sem alterar o original e sem vazar no contexto', () => {
    const original = 'Fale com ana.teste@exemplo.test ou (11) 91234-5678 hoje.';
    const f = scanText(original);
    const masked = applyMasking(original, f);
    expect(masked).toBe('Fale com [e-mail omitido] ou [telefone omitido] hoje.');
    expect(original).toContain('ana.teste');
    const email = f.find((x) => x.category === 'email')!;
    const ctx = maskedContext(original, email, f);
    expect(ctx.after).toContain('[telefone omitido]');
    expect(ctx.after).not.toContain('91234');
  });

  it('lida com entradas longas e caracteres especiais sem travar', () => {
    const big = 'a'.repeat(5000) + ' ' + '9'.repeat(3000) + ' ' + '<>&"\'`\\\u202e';
    const t0 = Date.now();
    scanText(big);
    expect(Date.now() - t0).toBeLessThan(2000);
  });
});
