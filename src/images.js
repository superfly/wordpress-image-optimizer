import cache from './response-cache';
import { Image } from '@fly/image'

export function processImages(config, fetch) {
  if (!fetch) {
    fetch = config
    config = undefined
  }
  return async function processImages(req, opts) {
    const url = new URL(req.url);
    const accept = req.headers.get('accept') || '';
    const sizes = (config && config.sizes) || {};
    let webp = false;

    let vary = [];
    // figure out if we need a new size
    let width = undefined;
    if (url.search) {
      const key = url.search.substring(1);
      const s = sizes[key];
      if (s && s.width) {
        width = s.width;
        vary.push(`w${width}`);
      }
    }

    if (
      accept.includes('image/webp') &&
      req.headers.get('fly-webp') !== 'off'
    ) {
      vary.push('webp');
      webp = true;
    }

    // generate a cache key with filename + variants
    const key = ['image', url.pathname].concat(vary).join(':');

    let resp = await cache.get(key);
    if (resp) {
      resp.headers.set('Fly-Cache', 'HIT');
      return resp;
    }

    // cache miss, do the rest
    req.headers.delete('accept-encoding'); // simplify by not having to inflate
    resp = await fetch(req, opts);

    const contentType = resp.headers.get('content-type');

    // skip a bunch of request/response types
    if (
      resp.status != 200 || // skip non 200 status codes
      req.method != 'GET' || // skip post/head/etc
      (!contentType.includes('image/png') && !contentType.includes("image/jpeg"))
    ) {
      return resp; // don't do anything for most requests
    }

    // if we got here, it's an image

    let data = await resp.arrayBuffer();
    let dirty = false;
    if (webp && contentType.includes('image/webp')) {
      // already webp, noop
      webp = false;
    }
    if (webp || width) {
      let image = new Image(data);
      if (width) {
        image.withoutEnlargement().resize(width);
      }
      if (webp) {
        image.webp();
      }
      const result = await image.toBuffer();
      data = result.data;
    }

    resp = new Response(data, resp);
    if (webp) resp.headers.set('content-type', 'image/webp');
    resp.headers.set('content-length', data.byteLength);
    await cache.set(key, resp, 3600 * 24); // cache for 24h

    resp.headers.set('Fly-Cache', 'MISS');

    return new Response(data, resp);
  };
}