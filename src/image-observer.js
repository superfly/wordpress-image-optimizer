export const lazyImageScript = `(function () {
  function preloadImage(img) {

    const src = img.dataset['imageSrc']

    if (src) {
      if (src && src.length > 0) img.src = src

      const srcset = img.dataset['imageSrcset']
      if (srcset && srcset.length > 0) img.srcset = srcset

      const style = img.dataset['style'] || ""
      img.style = style
    }

    const bg = img.querySelector(".bgImgSrc")

    if (bg) {
      let src = bg.innerHTML
      let parent = bg.parentNode
      parent.style = "background-image:url('" + src + "');"
    }


    //img.dataset['imageSrc'] = image.dataset['imageSrcset'] = image.data['style'] = ''
  }
  function hookupPreloads() {
    const images = document.querySelectorAll('img[data-image-src],img[data-image-srcset], .large-background-images, .small-background-images');
    // If we don't have support for intersection observer, load the images immediately
    if (!('IntersectionObserver' in window)) {
      Array.from(images).forEach(image => preloadImage(image));
    } else {
      const config = {
        // If the image gets within 50px in the Y axis, start the download.
        rootMargin: '50px 0px'
      };

      // The observer for the images on the page
      let observer = new IntersectionObserver(onIntersection, config);
      function onIntersection(entries) {
        // Loop through the entries
        entries.forEach(entry => {
          // Are we in viewport?
          if (entry.intersectionRatio > 0) {
            // Stop watching and load the image
            observer.unobserve(entry.target);
            preloadImage(entry.target);
          }
        });
      }

      images.forEach(image => {
        if (!image.waitingForPreload) {
          observer.observe(image);
          image.waitingForPreload = true
        }
      });
    }
  }

  const i = setInterval(hookupPreloads, 200)
  document.addEventListener("DOMContentLoaded", function () {
    clearInterval(i)
    hookupPreloads()
  })
})()`