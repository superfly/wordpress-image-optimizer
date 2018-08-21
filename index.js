import { processImages, parse } from './src/html'
import proxy from '@fly/proxy' 

const wordpress = proxy(`https://flyexample.wordpress.com/`,
  {
    headers: {
      'host': `flyexample.wordpress.com`,
      'x-forwarded-host': false
    }
})

fly.http.respondWith(processImages(parse(wordpress)))