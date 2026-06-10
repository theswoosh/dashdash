import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { validateConfig } from '../config/validator.js';

function writeYml(dir: string, name: string, content: string) {
  writeFileSync(join(dir, name), content);
}

describe('validateConfig', () => {
  it('returns empty when all config files are missing', () => {
    const emptyDir = mkdtempSync(join(tmpdir(), 'dashdash-validator-empty-'));
    try {
      const issues = validateConfig(emptyDir);
      expect(issues).toEqual([]);
    } finally {
      rmSync(emptyDir, { recursive: true });
    }
  });

  it('returns empty for a minimal valid config', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dashdash-validator-valid-'));
    try {
      writeYml(dir, 'settings.yml', 'title: My Dashboard\ntheme: dark\n');
      writeYml(dir, 'services.yml', `
- title: Clock
  widget: clock
  layout:
    w: 2
    h: 2
`);
      const issues = validateConfig(dir);
      expect(issues).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it('treats an empty services.yml as no widgets, not an error', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dashdash-validator-emptysvc-'));
    try {
      // User deleted every widget — file is now empty (js-yaml parses to undefined)
      writeYml(dir, 'services.yml', '');
      writeYml(dir, 'integrations.yml', '\n');
      writeYml(dir, 'widgets.yml', '# only a comment\n');
      const issues = validateConfig(dir);
      expect(issues).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it('reports error when grid cellSize/sizes violate the 1–100 range', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dashdash-validator-grid-'));
    try {
      writeYml(dir, 'settings.yml', 'grid:\n  cellSize: 200\n  sizes: [10, 0, 40]\n');
      const issues = validateConfig(dir);
      const cellIssue = issues.find(i => i.file === 'settings.yml' && i.field === 'grid.cellSize' && i.level === 'error');
      const sizeIssue = issues.find(i => i.file === 'settings.yml' && i.field === 'grid.sizes[1]' && i.level === 'error');
      expect(cellIssue).toBeDefined();
      expect(sizeIssue).toBeDefined();
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it('reports error for title exceeding max length', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dashdash-validator-title-'));
    try {
      const longTitle = 'A'.repeat(200);
      writeYml(dir, 'settings.yml', `title: "${longTitle}"\n`);
      const issues = validateConfig(dir);
      const titleIssue = issues.find(i => i.file === 'settings.yml' && i.field === 'title');
      expect(titleIssue).toBeDefined();
      expect(titleIssue?.level).toBe('error');
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it('reports error for smtp.port out of range', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dashdash-validator-smtp-'));
    try {
      writeYml(dir, 'settings.yml', 'mail:\n  smtp:\n    port: 99999\n');
      const issues = validateConfig(dir);
      const portIssue = issues.find(i => i.file === 'settings.yml' && i.field === 'mail.smtp.port');
      expect(portIssue).toBeDefined();
      expect(portIssue?.level).toBe('error');
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it('reports warning for search engine URL missing {query}', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dashdash-validator-query-'));
    try {
      writeYml(dir, 'settings.yml', `searchEngines:\n  - id: test\n    label: Test\n    url: https://example.com/search\n`);
      const issues = validateConfig(dir);
      const urlIssue = issues.find(i => i.file === 'settings.yml' && i.field.includes('url') && i.level === 'warning');
      expect(urlIssue).toBeDefined();
      expect(urlIssue?.message).toMatch(/\{query\}/);
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it('reports error for search engine id with invalid pattern', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dashdash-validator-id-'));
    try {
      writeYml(dir, 'settings.yml', `searchEngines:\n  - id: "My Engine!"\n    label: Test\n    url: https://example.com/?q={query}\n`);
      const issues = validateConfig(dir);
      const idIssue = issues.find(i => i.file === 'settings.yml' && i.field.includes('id') && i.level === 'error');
      expect(idIssue).toBeDefined();
      expect(idIssue?.message).toBe('ID must be lowercase letters, digits and hyphens only');
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it('reports warning for unknown widget type in services.yml', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dashdash-validator-widget-'));
    try {
      writeYml(dir, 'services.yml', `
- title: Unknown
  widget: nonexistent-widget
  layout:
    w: 2
    h: 2
`);
      const issues = validateConfig(dir);
      const widgetIssue = issues.find(i => i.file === 'services.yml' && i.field.includes('widget') && i.level === 'warning');
      expect(widgetIssue).toBeDefined();
      expect(widgetIssue?.message).toMatch(/nonexistent-widget/);
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it('reports warning when service references nonexistent integration', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dashdash-validator-integ-'));
    try {
      writeYml(dir, 'services.yml', `
- title: My Widget
  widget: clock
  integration: missing-integration
  layout:
    w: 2
    h: 2
`);
      // No integrations.yml — so missing-integration should warn
      const issues = validateConfig(dir);
      const integIssue = issues.find(i => i.file === 'services.yml' && i.field.includes('integration') && i.level === 'warning');
      expect(integIssue).toBeDefined();
      expect(integIssue?.message).toMatch(/missing-integration/);
    } finally {
      rmSync(dir, { recursive: true });
    }
  });


  it('reports error for invalid YAML syntax', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dashdash-validator-yaml-'));
    try {
      writeYml(dir, 'settings.yml', 'title: [\nbad yaml\n');
      const issues = validateConfig(dir);
      const yamlIssue = issues.find(i => i.file === 'settings.yml' && i.field === '(yaml)');
      expect(yamlIssue).toBeDefined();
      expect(yamlIssue?.level).toBe('error');
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it('returns errors before warnings in sorted output', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dashdash-validator-sort-'));
    try {
      // Title too long (error) + search URL missing {query} (warning)
      const longTitle = 'X'.repeat(200);
      writeYml(dir, 'settings.yml', `title: "${longTitle}"\nsearchEngines:\n  - id: test\n    label: Test\n    url: https://example.com/\n`);
      const issues = validateConfig(dir);
      expect(issues.length).toBeGreaterThan(0);
      const firstError = issues.findIndex(i => i.level === 'error');
      const firstWarning = issues.findIndex(i => i.level === 'warning');
      if (firstError !== -1 && firstWarning !== -1) {
        expect(firstError).toBeLessThan(firstWarning);
      }
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it('reports warning for integration URL not starting with http', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dashdash-validator-url-'));
    try {
      writeYml(dir, 'integrations.yml', `
- id: myapp
  type: custom
  url: ftp://invalid-url
`);
      const issues = validateConfig(dir);
      const urlIssue = issues.find(i => i.file === 'integrations.yml' && i.field.includes('url') && i.level === 'warning');
      expect(urlIssue).toBeDefined();
      expect(urlIssue?.message).toMatch(/https?/);
    } finally {
      rmSync(dir, { recursive: true });
    }
  });
});
