import cache from '@fly/cache'
// a basic cache handler for Response objects
// This should be modified to vary by the appropriate headers
// + cookies + other stuff for each app

export async function get(key) {
  let meta = await getMeta(key)
  if (!meta) return;
  let body = await cache.get(key + ':body');

  if (!body) return; // miss
  let age = 0;
  if (meta.at) {
    age = parseInt(Date.now() / 1000) - meta.at;
    meta.headers.Age = age
    meta.headers['Fly-Age'] = meta.headers.Age;
    delete meta.at;
  }
  return new Response(body, meta);
}

const goodHeaders = [
  'content-type',
  'content-length',
  'content-encoding',
  'cache-control',
  'expires',
  'link',
  'set-cookie',
  'etag'
];
export async function touch(key) {
  let meta = await getMeta(key)
  meta.at = parseInt(Date.now() / 1000)
  return await setMeta(key, meta, meta.ttl)
}

export async function getMeta(key) {
  let meta = await cache.getString(key + ':meta');
  if (!meta) return; // cache miss
  try {
    meta = JSON.parse(meta);
  } catch (err) {
    return; // also a miss
  }
  return meta
}
export function expire(key) {
  return Promise.all([
    cache.expire(key + ":meta", 1),
    cache.expire(key + ":body", 1)
  ])
}
export function setMeta(key, meta, ttl) {
  return cache.set(key + ":meta", JSON.stringify(meta), ttl)
}
export async function set(key, response, ttl) {
  let meta = {
    status: response.status,
    headers: {},
    at: parseInt(Date.now() / 1000),
    ttl: ttl
  };

  const body = await response.clone().arrayBuffer();

  let etag = response.headers.get("etag")
  if (!etag || etag == '') {
    etag = hex(await crypto.subtle.digest("SHA-1", body))
    response.headers.set("etag", etag)
  }

  for (const h of goodHeaders) {
    const v = response.headers.getAll(h);
    if (v && v.length > 0) {
      meta.headers[h] = v.join(', ');
    }
  }
  const result = Promise.all([
    setMeta(key, meta, ttl),
    //cache.set(key + ':meta', JSON.stringify(meta), ttl),
    cache.set(key + ':body', body, ttl)
  ]);

  return result[0] && result[1];
}

export default {
  get,
  set,
  setMeta,
  touch,
  expire
};

// converts a buffer to hex, mainly for hashes
function hex(buffer) {
  var hexCodes = [];
  var view = new DataView(buffer);
  for (var i = 0; i < view.byteLength; i += 4) {
    // Using getUint32 reduces the number of iterations needed (we process 4 bytes each time)
    var value = view.getUint32(i)
    // toString(16) will give the hex representation of the number without padding
    var stringValue = value.toString(16)
    // We use concatenation and slice for padding
    var padding = '00000000'
    var paddedValue = (padding + stringValue).slice(-padding.length)
    hexCodes.push(paddedValue);
  }

  // Join all the hex strings into one
  return hexCodes.join("");
}