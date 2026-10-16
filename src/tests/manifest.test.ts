import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const manifest = JSON.parse(readFileSync('manifest.json', 'utf8')) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as Record<string, Record<string, string>>;

describe('manifest.json', () => {
  it('é Manifest V3 com campos obrigatórios', () => {
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.name).toBeTruthy();
    expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(manifest.description.length).toBeLessThanOrEqual(132);
  });

  it('usa somente as permissões mínimas justificadas', () => {
    expect([...manifest.permissions].sort()).toEqual(['sidePanel', 'storage']);
    for (const key of ['host_permissions', 'optional_permissions', 'optional_host_permissions', 'content_scripts', 'externally_connectable', 'web_accessible_resources', 'commands', 'omnibox', 'devtools_page']) {
      expect(manifest[key], key).toBeUndefined();
    }
  });

  it('tem CSP restritiva, local e sem rede', () => {
    const csp: string = manifest.content_security_policy.extension_pages;
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("connect-src 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).not.toMatch(/unsafe-|https?:|\*|data:/);
  });

  it('referencia arquivos que existem', () => {
    expect(existsSync(manifest.action.default_popup)).toBe(true);
    expect(existsSync(manifest.side_panel.default_path)).toBe(true);
    expect(existsSync('src/infrastructure/background.ts')).toBe(true);
    expect(existsSync(`public/${manifest.storage.managed_schema}`)).toBe(true);
    for (const icon of Object.values<string>(manifest.icons)) expect(existsSync(`public/${icon}`)).toBe(true);
    expect(manifest.background.service_worker).toBe('background.js');
  });

  it('o esquema de política gerenciada é JSON válido e não aceita segredos', () => {
    const schema = JSON.parse(readFileSync('public/managed-schema.json', 'utf8')) as { properties: Record<string, unknown> };
    expect(Object.keys(schema.properties).sort()).toEqual(['aiProvider', 'languageProfile', 'profileSigningPublicKeys', 'usageCounters']);
    expect(JSON.stringify(schema).toLowerCase()).not.toMatch(/apikey|api_key|token|secret|password/);
  });
});

describe('dependências', () => {
  it('estão fixadas em versões exatas', () => {
    for (const group of [pkg.dependencies, pkg.devDependencies]) {
      for (const [name, version] of Object.entries(group ?? {})) expect(version, name).toMatch(/^\d+\.\d+\.\d+$/);
    }
  });

  it('não incluem bibliotecas de rede, analytics ou rastreamento', () => {
    const all = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).join(' ');
    expect(all).not.toMatch(/axios|analytics|sentry|segment|mixpanel|posthog|amplitude|gtag|hotjar|socket\.io|node-fetch/i);
  });
});
