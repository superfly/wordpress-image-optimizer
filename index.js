import proxy from '@fly/proxy'
import { processImages } from './src/images';
import responseCache from './src/response-cache';
import { lazyImageScript } from './src/image-observer';

const origin = proxy("https://www.thewaltdisneycompany.com/")
const assets = proxy("https://www.thewaltdisneycompany.com/wp-content/", { stripPath: "/wp-content/" })

fly.http.respondWith(
  pipeline(
    // set srcset attr on img tags, lazy-load img tags & background images, reduce render-blocking css & js
    responsiveImages,
    // convert all images to webp
    processImages,
    // rewrite image links so that we can handle image requests
    rewriteLinks,
    // mount new image links to root
    mount({
      "/wp-content/": assets,
      "/": origin
    })
  )
)

const bgImages = {
  "group1": {
    selector: ".large-background-images"
  },
  "group2": {
    selector: ".small-background-images"
  }
}

const rewrites = [
  [/(https?:)?\/\/www.thewaltdisneycompany\.com.wp.content/g, "/wp-content/"]
]

function rewriteLinks(fetch) {
  return async function rewriteHTML(req, init) {
    req.headers.delete("accept-encoding")
    const resp = await fetch(req, init)
    if (app.env === "development") {
      console.log("removing sts headers")
      resp.headers.delete("strict-transport-security")
      resp.headers.delete("content-security-policy")
    }
    const contentType = resp.headers.get("content-type") || ""
    if (
      contentType.includes("/html") ||
      contentType.includes("application/javascript") ||
      contentType.includes("application/json") ||
      contentType.includes("text/")
    ) {
      let body = await resp.text()
      for (const r of rewrites) {
        body = body.replace(r[0], r[1])
      }
      resp.headers.delete("content-length")
      return new Response(body, resp)
    }
    return resp
  }
}

function responsiveImages(fetch) {
  return async function responsiveImages(req, init) {

    if (req.method != "GET") {
      return fetch(req, init)
    }

    // serve cached response if there is one

    const key = `html:${req.url}`
    let resp = await responseCache.get(key)
    if (resp) {
      resp.headers.set("Fly-Cache", "HIT")
      return resp
    }
    resp = await fetch(req, init)
    const contentType = resp.headers.get("content-type") || ""
    if (!contentType.includes("html") || resp.status != 200) {
      return resp
    }

    resp.headers.delete("content-length")
    let body = await resp.text()

    let cached = await fly.cache.get(key)
    if (cached) {
      resp.headers.set("Fly-Cache", "HIT")
      return new Response(cached, resp)
    }
    const doc = Document.parse(body)
    const replacements = []

    // set srcset attributes on image tags

    const imageElements = doc.querySelectorAll('img[src]')
    for (const img of imageElements) {
      let imgSrc = img.getAttribute("src")
      let imgSrcSet = img.getAttribute("srcset")
      if (imgSrcSet === null || "") {
        const srcSet = [
          `${src}?/600w 600w`,
          `${src}?/900w 900w`,
          `${src}?/1440w 1440w`
        ]
        
        img.setAttribute("srcset", srcSet.join(","))
      }
    }

    // lazy-load background images

    for (const bgImg of Object.keys(bgImages)) {
      const o = bgImages[bgImg]
      const elements = doc.querySelectorAll(o.selector)

      for (const el of elements) {
        let style = el.getAttribute('style')
        if (style) {
          let txt = style.substring(style.indexOf("url('") + 5)
          let newSrc = txt.replace(/(?<=jpg).*$/,"")
          
          el.appendChild(`<p class="bgImgSrc" style="visibility:hidden;"" >${newSrc}</p>`)
          el.setAttribute("style", "")
          }
        }
      }

    // lazy-load image tags

    for (const lazyImg of doc.querySelectorAll("img[src]")) {
      const src = lazyImg.getAttribute("src")
      const srcset = lazyImg.getAttribute("srcset")

      let style = lazyImg.getAttribute('style') || ""
      lazyImg.setAttribute('data-style', style)
      style = `visibility: hidden;${style}`
      lazyImg.setAttribute('style', style)

        if (src) {
          lazyImg.setAttribute("src", '')
          lazyImg.setAttribute("data-image-src", src)
        }
        if (srcset) {
          lazyImg.setAttribute("srcset", '')
          lazyImg.setAttribute("data-image-srcset", srcset)
        }

        lazyImg.setAttribute("onerror", '')
    }

    // add image-observer script to doc

    if (!doc.querySelector("script#lazy-images")) {
      let script = lazyImageScript
      const target = doc.querySelector("head")
      if (target) {
        target.appendChild(`<script id="lazy-images">${script}</script>`)
      }
    }

    // reduce render-blocking-resources

    doc.querySelector("#twdc-theme-main-css").setAttribute("media", "none")
    doc.querySelector("#twdc-theme-main-css").setAttribute("onload", "if(media!='all')media='all'")

    let scripts = doc.querySelectorAll("script")
    for (const s of scripts) {
      s.setAttribute("defer", true)
    }

    // return the html with new changes made

    body = doc.documentElement.outerHTML
    for (const r of replacements) {
      body = body.replace(r[0], r[1])
    }
    await fly.cache.set(key, body, 3600)

    resp = new Response(body, resp)
    await responseCache.set(key, resp, 3600)
    return resp
  }
}

function mount(paths) {
  return function mount(req, init) {
    const url = new URL(req.url)
    for (const p of Object.getOwnPropertyNames(paths)) {
      if (url.pathname.startsWith(p)) {
        return paths[p](req, init)
      }
    }
    return new Response("no mount found", { status: 404 })
  }
}

function pipeline() {
  let fn = null
  for (let i = arguments.length - 1; i >= 0; i--) {
    if (fn) {
      console.log(`wrapping ${fn.name} with ${arguments.name}`)
      fn = arguments[i](fn)
    } else {
      fn = arguments[i]
    }
  }
  return fn
}