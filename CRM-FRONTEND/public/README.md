# Public Assets

This directory contains static assets that are served directly by the web server.

## Structure

- `images/` - Image assets (logos, icons, illustrations)
- `icons/` - Icon files (favicon, app icons)
- `fonts/` - Custom font files
- `documents/` - Static documents (PDFs, etc.)
- `manifest.json` - Web app manifest
- `robots.txt` - Search engine crawler instructions
- `sitemap.xml` - Site structure for search engines

## Guidelines

- Optimize images for web (use appropriate formats and compression)
- Use descriptive filenames
- Organize assets in appropriate subdirectories
- Include alt text and descriptions for accessibility
- Consider using a CDN for large assets in production

## File Naming

- Use lowercase with hyphens: `my-image.jpg`
- Include dimensions for multiple sizes: `logo-32x32.png`
- Use semantic names: `hero-background.jpg` instead of `img1.jpg`

## Optimization

- Compress images before adding them
- Use modern formats (WebP, AVIF) when possible
- Provide multiple sizes for responsive images
- Consider lazy loading for large images
