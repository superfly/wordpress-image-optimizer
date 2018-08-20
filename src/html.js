export function parse(fetch) {
  return async function parse(req) {
	let resp = await fetch(req)

  const accept = req.headers.get("accept") || ""
  if (accept.includes("image/webp") && req.headers.get("fly-webp") !== "off") {

    resp = await withDocument(resp)

    const html = resp.document.documentElement.outerHTML
    resp = new Response(html, resp)
    resp.headers.delete("content-length")
  }
  return resp
  }
}

export async function withDocument(resp, req) {

	let body = await resp.text()
	resp = new Response(body, resp)
  resp.document = Document.parse(body)

  let imageNum = 0

  	const imageElements = resp.document.querySelectorAll('img[src]')
    for (const el of imageElements) {
      let vary = []
      vary.push("webp")

      let imageLink = el.getAttribute("src")

      const mySite = "flyexample.wordpress.com"
      const key = [mySite, "image", imageNum].concat(vary).join(':')
      console.log(key)
      imageNum = imageNum + 1

      let createImage = resp.document.createElement("img")

      let imageResponse = await fly.cache.get(key)
      if (imageResponse) {
        // imageResponse.headers.set("Fly-Cache", "HIT")
        console.log("CACHE HIT", key)
        createImage.setAttribute("src", 'data:image/webp;base64,' + new Buffer(imageResponse).toString('base64'))
        el.replaceWith(createImage)
      } else {
        imageResponse = await fetch(imageLink)

        let data = await imageResponse.arrayBuffer()
        
        let image = new fly.Image(data)
        image.webp()

        const result = await image.toBuffer()

        data = result.data

        // imageResponse = new Response(data, imageResponse)
        // imageResponse.headers.set("content-type", "image/webp")
        // imageResponse.headers.set("content-length", data.byteLength)
        // let convertedImage = new Response(data, imageResponse)
        // imageResponse.headers.set("content-length", data.byteLength)

        await fly.cache.set(key, data, 3600 * 24) // cache for 24h
        imageResponse.headers.set("Fly-Cache", "MISS")
        console.log("CACHE MISS", key)

        createImage.setAttribute("src", 'data:image/webp;base64,' + new Buffer(data).toString('base64'))
        el.replaceWith(createImage)
      }
    }

  body = resp.document.documentElement.outerHTML
  resp.headers.delete("content-length")
  return resp
}

export function processImages(fetch) {
  return async function processImages(req) {

    req.headers.delete("accept-encoding") 
    let resp = await fetch(req)

    return resp
  } 
} 





