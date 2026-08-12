import { createClient } from 'npm:@supabase/supabase-js@2';

import { normalizeRawReceiptPayload, validateParsedReceiptPayload } from './validation.ts';

const OPENAI_MODEL = 'gpt-4o';
const RECEIPT_BUCKET = 'receipt-images';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type ParseReceiptRequest = {
  expenseId?: string;
  receiptPath?: string;
  preferredCurrency?: string;
};

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function safeClientError(code: string): string {
  switch (code) {
    case 'blurry':
      return 'This receipt was too blurry to read. Try a clearer photo or enter the expense manually.';
    case 'no_total':
      return 'We could not find a total on this receipt. You can edit the details manually.';
    case 'invalid_output':
      return 'We could not understand the receipt data. Please review and edit manually.';
    case 'timeout':
      return 'Receipt reading timed out. Please try again.';
    default:
      return 'Receipt scanning failed. Please try again or enter the expense manually.';
  }
}

function verifyReceiptPath(receiptPath: string, userId: string, spaceId: string): boolean {
  const parts = receiptPath.split('/').filter(Boolean);
  if (parts.length < 3) return false;
  if (parts[0] !== userId) return false;
  if (parts[1] !== spaceId) return false;
  return true;
}

function receiptJsonSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    required: [
      'merchant_name',
      'expense_title',
      'expense_date',
      'original_currency',
      'subtotal',
      'tax',
      'tip',
      'fees',
      'discount',
      'total',
      'items',
      'warnings',
    ],
    properties: {
      merchant_name: { type: ['string', 'null'] },
      expense_title: { type: 'string' },
      expense_date: { type: ['string', 'null'] },
      original_currency: { type: 'string' },
      subtotal: { type: ['number', 'null'] },
      tax: { type: 'number' },
      tip: { type: 'number' },
      fees: { type: 'number' },
      discount: { type: 'number' },
      total: { type: 'number' },
      items: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['name', 'quantity', 'unit_price', 'line_total', 'category', 'source_text', 'confidence'],
          properties: {
            name: { type: 'string' },
            quantity: { type: 'number' },
            unit_price: { type: ['number', 'null'] },
            line_total: { type: 'number' },
            category: { type: ['string', 'null'] },
            source_text: { type: ['string', 'null'] },
            confidence: { type: 'number' },
          },
        },
      },
      warnings: { type: 'array', items: { type: 'string' } },
    },
  };
}

async function callOpenAiVision(base64Image: string, mimeType: string): Promise<unknown> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) {
    throw new Error('missing_openai_key');
  }

  const schema = receiptJsonSchema();

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: [
                'Extract structured receipt data from this image.',
                'Preserve the receipt original currency; do not convert currencies.',
                'Do not invent line items that are not on the receipt.',
                'Do not force totals to match — report what is printed.',
                'Separate subtotal, tax, tip, fees, and discounts when visible.',
                'If quantity is shown, preserve it. If only a line total is shown, set line_total accordingly.',
                'Use English names when practical but preserve source_text from the receipt.',
                'Add warnings for uncertain or unreadable fields.',
                'Return strict JSON matching the schema.',
              ].join(' '),
            },
            {
              type: 'input_image',
              image_url: `data:${mimeType};base64,${base64Image}`,
            },
          ],
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'receipt_extraction',
          schema,
          strict: true,
        },
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error('OpenAI error', response.status, text.slice(0, 500));
    throw new Error('openai_failed');
  }

  const payload = await response.json();

  const outputText =
    payload.output_text ??
    payload.output
      ?.flatMap((entry: { content?: { type?: string; text?: string }[] }) => entry.content ?? [])
      ?.find((part: { type?: string; text?: string }) => part.type === 'output_text')?.text;

  if (!outputText || typeof outputText !== 'string') {
    throw new Error('invalid_output');
  }

  return JSON.parse(outputText);
}

function mimeFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'heic':
    case 'heif':
      return 'image/heic';
    default:
      return 'image/jpeg';
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return jsonResponse({ error: safeClientError('default') }, 500);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const jwt = authHeader.replace('Bearer ', '');

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });

  const admin = createClient(supabaseUrl, serviceRoleKey);

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser(jwt);

  if (userError || !user) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  let body: ParseReceiptRequest;
  try {
    body = (await req.json()) as ParseReceiptRequest;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const expenseId = body.expenseId?.trim();
  const receiptPath = body.receiptPath?.trim();
  const preferredCurrency = body.preferredCurrency?.trim().toUpperCase() ?? 'USD';

  if (!expenseId || !receiptPath) {
    return jsonResponse({ error: 'Missing expenseId or receiptPath' }, 400);
  }

  const { data: expense, error: expenseError } = await userClient
    .from('expenses')
    .select('id, space_id, created_by, receipt_image_path')
    .eq('id', expenseId)
    .maybeSingle();

  if (expenseError || !expense) {
    return jsonResponse({ error: 'Expense not found or access denied' }, 403);
  }

  if (expense.receipt_image_path && expense.receipt_image_path !== receiptPath) {
    return jsonResponse({ error: 'Receipt path mismatch' }, 403);
  }

  if (!verifyReceiptPath(receiptPath, user.id, expense.space_id)) {
    return jsonResponse({ error: 'Unauthorized receipt path' }, 403);
  }

  const now = new Date().toISOString();

  const { data: existingJob } = await admin
    .from('receipt_processing_jobs')
    .select('attempt_count')
    .eq('expense_id', expenseId)
    .maybeSingle();

  const nextAttempt = (existingJob?.attempt_count ?? 0) + 1;

  await admin
    .from('receipt_processing_jobs')
    .update({
      status: 'processing',
      started_at: now,
      attempt_count: nextAttempt,
      provider: 'openai',
      model: OPENAI_MODEL,
      error_message: null,
    })
    .eq('expense_id', expenseId);

  await admin
    .from('expenses')
    .update({ receipt_status: 'processing', processing_error: null })
    .eq('id', expenseId);

  try {
    const { data: file, error: downloadError } = await admin.storage
      .from(RECEIPT_BUCKET)
      .download(receiptPath);

    if (downloadError || !file) {
      throw new Error('download_failed');
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64Image = btoa(binary);
    const mimeType = mimeFromPath(receiptPath);

    const rawModel = await callOpenAiVision(base64Image, mimeType);
    const normalized = normalizeRawReceiptPayload(rawModel);
    const validated = validateParsedReceiptPayload(normalized);

    if (!validated.ok) {
      const code = validated.error.includes('total') ? 'no_total' : 'invalid_output';
      throw new Error(code);
    }

    const parsed = validated.data;

    if (parsed.warnings.some((w) => /blur|unreadable/i.test(w))) {
      throw new Error('blurry');
    }

    await admin.from('expense_items').delete().eq('expense_id', expenseId);

    if (parsed.items.length > 0) {
      const rows = parsed.items.map((item, index) => ({
        expense_id: expenseId,
        name: item.name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        line_total: item.line_total,
        category: item.category,
        sort_order: index,
        source_text: item.source_text,
        confidence: item.confidence,
      }));

      const { error: itemsError } = await admin.from('expense_items').insert(rows);
      if (itemsError) {
        throw new Error('items_insert_failed');
      }
    }

    const completedAt = new Date().toISOString();

    await admin
      .from('expenses')
      .update({
        merchant_name: parsed.merchant_name,
        expense_title: parsed.expense_title,
        expense_date: parsed.expense_date,
        original_currency: parsed.original_currency,
        display_currency: preferredCurrency,
        subtotal: parsed.subtotal,
        tax: parsed.tax,
        tip: parsed.tip,
        fees: parsed.fees,
        discount: parsed.discount,
        total: parsed.total,
        receipt_status: 'needs_review',
        processing_error: null,
        receipt_image_path: receiptPath,
      })
      .eq('id', expenseId);

    await admin
      .from('receipt_processing_jobs')
      .update({
        status: 'completed',
        extracted_payload: parsed,
        completed_at: completedAt,
        error_message: null,
      })
      .eq('expense_id', expenseId);

    return jsonResponse({ ok: true, expenseId, status: 'needs_review' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'default';
    const clientMessage = safeClientError(message);

    await admin
      .from('expenses')
      .update({
        receipt_status: 'failed',
        processing_error: clientMessage,
      })
      .eq('id', expenseId);

    await admin
      .from('receipt_processing_jobs')
      .update({
        status: 'failed',
        error_message: clientMessage,
        completed_at: new Date().toISOString(),
      })
      .eq('expense_id', expenseId);

    console.error('parse-receipt failed', message);

    return jsonResponse({ error: clientMessage }, 422);
  }
});
