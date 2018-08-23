export async function withDocument(resp) { 
  if (resp.document) { 
    // already done 
    return resp 
  } 

  const contentType = resp.headers.get("content-type") || "" 
  if (!contentType.includes("text/html")) { 
    return resp 
  } 

  let html = await resp.text() 
  // the body can't be read again, make a new response 
  resp = new Response(html, resp) 
  resp.document = Document.parse(html) 
  return resp 
} 

export async function responseDocument(resp) { 
  resp = await withDocument(resp) 
  return resp.document 
} 

export default { 
  withDocument, 
  responseDocument 
}