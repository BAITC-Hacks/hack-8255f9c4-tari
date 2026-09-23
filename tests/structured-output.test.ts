import test from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { createProvider } from '../lib/ai/provider';
import { extractionSchema, comparisonSchema } from '../lib/schema';

test('OpenAI receives the complete validation schema; compatible providers keep their contract', async () => {
  const original = { ...process.env };
  const originalFetch = globalThis.fetch;
  let body: Record<string, unknown> = {};
  let content: unknown = { entities: [] };
  let refusal: string | undefined;
  globalThis.fetch = async (_url, init) => {
    body = JSON.parse(String(init?.body));
    return Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(content), refusal } }] });
  };
  try {
    process.env.AI_API_KEY = 'test-placeholder';
    process.env.AI_MODEL = 'gpt-4.1-mini';
    process.env.AI_BASE_URL = 'https://api.openai.com/v1';
    const signal = new AbortController().signal;
    for (const schema of [extractionSchema, comparisonSchema]) {
      content = schema === extractionSchema ? { entities: [] } : { findings: [] };
      await createProvider().json('Return JSON', {}, schema as z.ZodType, signal);
      assert.deepEqual(body.response_format, {
        type: 'json_schema',
        json_schema: { name: 'orglens_result', strict: true, schema: z.toJSONSchema(schema) },
      });
    }
    content = { entities: [{ type: 'function', name: 'Valid name', owner: '', sourceId: 'before-1', quote: 'short' }] };
    await assert.rejects(createProvider().json('', {}, extractionSchema, signal), /entities.0.quote \(too_small\)/);
    refusal = 'Refused';
    await assert.rejects(createProvider().json('', {}, extractionSchema, signal), /AI отказался/);
    refusal = undefined;
    content = { entities: [] };
    process.env.AI_BASE_URL = 'https://integrate.api.nvidia.com/v1';
    await createProvider().json('', {}, extractionSchema, signal);
    assert.equal(body.response_format, undefined);
    assert.ok(JSON.stringify(body.messages).includes('minLength'));
  } finally {
    process.env = original;
    globalThis.fetch = originalFetch;
  }
});
