// What the Worker's two freshness routes share, so neither route imports the other and the entry
// module's exports stay as they are (T044). Both read one small record from R2 and answer the same
// way: the record re-shaped to its contract's fields, or a 503 if it is missing or malformed, so
// the page keeps its build-time text.

// The subset of the Workers runtime types the routes use (R2Bucket.get).
export interface StoredObject {
  text(): Promise<string>;
}

export interface FreshnessBucket {
  get(key: string): Promise<StoredObject | null>;
}

// utcTimestamp in schemas/defs.schema.json: second precision, always Z.
const UTC_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

export function timestamp(value: unknown): string | undefined {
  return typeof value === 'string' && UTC_TIMESTAMP.test(value) ? value : undefined;
}

export function respond(method: string, status: number, body: string, headers: HeadersInit): Response {
  return new Response(method === 'HEAD' ? null : body, { status, headers });
}

/** GET or HEAD of the record at `key`, re-shaped by `parse`, which returns undefined if it's malformed. */
export async function serveRecord<T>(request: Request, bucket: FreshnessBucket, key: string, parse: (text: string) => T | undefined): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } });
  }
  let record: T | undefined;
  try {
    const object = await bucket.get(key);
    record = object ? parse(await object.text()) : undefined;
  } catch {
    record = undefined;
  }
  if (record === undefined) {
    return respond(request.method, 503, '{"error":"unavailable"}', {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    });
  }
  return respond(request.method, 200, JSON.stringify(record), {
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=300',
  });
}
