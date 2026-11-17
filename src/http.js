export function sendJson(response, status, data, headers = {}) {
  const body = status === 204 ? null : JSON.stringify(data);
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': body ? Buffer.byteLength(body) : 0,
    ...headers,
  });
  response.end(body);
}

export async function readBody(request, maxBytes) {
  const chunks = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > maxBytes) {
      const error = new Error('payload too large');
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export async function readJson(request, maxBytes = 1024 * 1024) {
  const body = await readBody(request, maxBytes);
  try {
    return JSON.parse(body.toString('utf8'));
  } catch {
    const error = new Error('JSON illisible');
    error.status = 400;
    throw error;
  }
}

