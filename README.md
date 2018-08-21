# WordPress Image Optimizer

This Fly App speeds up any WordPress site by optimizing images, which dramatically improves Lighthouse scores.

## Lighthouse

Google Lighthouse measures user perceived application performance, and assigns a score of 0-100 (100 is good, 0 is gross).

### Before optimizations

### With optimizations

## What it does

This app primarily optimizes images:

1. Converts and serves all images in WebP format when browsers send an `Accept: image/webp` header
2. Adds `srcset` attributes to image tags, which defines multiple sizes of the same image, allowing the browser to appropriately select which image source to use based on device size

## Try it yourself

1. First, make sure you have the latest version of Fly installed by running `npm i -g @fly/fly`
2. `git clone https://github.com/superfly/wordpress-image-optimizer.git`
3. `cd wordpress-image-optimizer`
4. `fly server`
5. Visit http://localhost:3000 to view the app

You should Fly's example WordPress site (https://flyexample.wordpress.com/)

6. Navigate to the `index.js` file and change `const wordpress` to match your own domain (line#4 and line#7)
7. Navigate to the `html.js` file and change `const mySite` to do the same (line#33)
8. If your site contains any background images, add their selector's to `const bgImages` in `html.js` (line#83)
9. Save and visit http://localhost:3000 again

You should now see your own WordPress site with properly sized, optimized images in the WebP format! Run a Lighthouse audit and see for yourself just how well your site is performing .. and then, deploy!

8. Run `fly login` (make sure you have a Fly account first, if you don’t, register at https://fly.io/app/sign-up)
9. Run `fly apps create <app-name>` to create a Fly Edge App
10. Then run `fly deploy` to deploy your Fly Edge App