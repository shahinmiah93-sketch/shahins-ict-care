import { Readable, Writable } from "node:stream";
import { Buffer } from "node:buffer";

export function nodeRequest(request) {
  const req = request.body ? Readable.fromWeb(request.body) : Readable.from([]);
  req.method = request.method;
  req.url = new URL(request.url).pathname + new URL(request.url).search;
  req.headers = Object.fromEntries(request.headers);
  const url = new URL(request.url);
  req.headers.host = url.host;
  req.headers["x-forwarded-proto"] = url.protocol.slice(0, -1);
  // Direct visitors cannot override the IP used by the existing rate limiters.
  req.headers["x-forwarded-for"] = request.headers.get("cf-connecting-ip") || "local";
  req.socket = { remoteAddress: request.headers.get("cf-connecting-ip") || "local" };
  return req;
}

export function nodeResponse() {
  const headers = new Headers(), chunks = [];
  let status = 200, resolve, reject, total = 0;
  const completed = new Promise((a,b) => { resolve = a; reject = b; });
  // Register immediately: stream errors can arrive before the caller awaits completion.
  completed.catch(() => {});
  const res = new Writable({
    write(chunk, encoding, cb) {
      total += chunk.length;
      if (total > 24 * 1024 * 1024) return cb(new Error("Response exceeds Cloudflare memory budget"));
      chunks.push(Buffer.from(chunk)); cb();
    }
  });
  res.headersSent = false;
  res.setHeader = (k,v) => {
    if (Array.isArray(v)) { headers.delete(k); for (const item of v) headers.append(k, String(item)); }
    else headers.set(k, String(v));
  };
  res.writeHead = (code, values = {}) => { status = code; for (const [k,v] of Object.entries(values)) res.setHeader(k,v); res.headersSent = true; return res; };
  res.on("finish", () => {
    res.headersSent = true;
    const body = status === 204 || status === 304 ? null : Buffer.concat(chunks);
    resolve(new Response(body, { status, headers }));
  });
  res.on("error", reject);
  return { res, completed };
}
