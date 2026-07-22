const crypto = require('crypto');

function chapterSlugFromUrl(value) {
  const match = String(value || '').match(/^\/chapters\/([a-z0-9](?:[a-z0-9-]{0,60}[a-z0-9])?)\/$/);
  return match ? match[1] : '';
}

module.exports = function(eleventyConfig) {
  // Copy static assets
  eleventyConfig.addPassthroughCopy("src/assets");
  eleventyConfig.addPassthroughCopy("src/css");
  eleventyConfig.addPassthroughCopy("src/js");
  eleventyConfig.addPassthroughCopy("src/manifest.json");
  eleventyConfig.addPassthroughCopy("src/robots.txt");
  eleventyConfig.addPassthroughCopy("src/sw.js");
  eleventyConfig.addPassthroughCopy("src/.well-known");

  // MD5 hash filter for Gravatar
  eleventyConfig.addFilter("md5", function(value) {
    if (!value) return '';
    return crypto.createHash('md5').update(value.trim().toLowerCase()).digest('hex');
  });

  // Chapter URLs are generated from the canonical application slug.
  eleventyConfig.addFilter("chapterSlugFromUrl", chapterSlugFromUrl);

  // Date filters for date-based event grouping in templates
  eleventyConfig.addFilter("dateToMs", function(value) {
    if (!value) return 0;
    var d = new Date(value);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  });
  eleventyConfig.addFilter("nowMs", function() {
    var d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  });

  // Human-readable date format: "1 August 2026"
  eleventyConfig.addFilter("humanDate", function(value) {
    if (!value) return '';
    var d = new Date(value + 'T00:00:00');
    if (isNaN(d.getTime())) return value;
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  });

  // Convert plain-text description to basic HTML paragraphs for SSR
  eleventyConfig.addFilter("descriptionToHtml", function(value) {
    if (!value) return '';
    // Handle legacy comma-separated format (", ," = paragraph break, ", -" = list item)
    var text = String(value);
    if (text.includes(', ,')) {
      text = text.replace(/, , /g, '\n\n').replace(/, -/g, '\n-');
    }
    // Split on double newlines for paragraphs
    var paragraphs = text.split(/\n{2,}/);
    return paragraphs.map(function(p) {
      p = p.trim();
      if (!p) return '';
      // Check if this paragraph is a list (lines starting with -)
      if (p.match(/^-/m)) {
        var items = p.split(/\n/).filter(function(l) { return l.trim(); });
        return '<ul>' + items.map(function(item) {
          return '<li>' + item.replace(/^-\s*/, '') + '</li>';
        }).join('') + '</ul>';
      }
      return '<p>' + p.replace(/\n/g, '<br>') + '</p>';
    }).filter(function(s) { return s; }).join('');
  });

  // Clean description for meta tags (plain text, no commas-as-separators)
  eleventyConfig.addFilter("metaDescription", function(value) {
    if (!value) return '';
    var text = String(value);
    if (text.includes(', ,')) {
      text = text.replace(/, , /g, ' ').replace(/, -/g, ' ');
    }
    // Collapse whitespace, trim, truncate to 160 chars
    text = text.replace(/\s+/g, ' ').trim();
    if (text.length > 160) {
      text = text.substring(0, 157) + '...';
    }
    return text;
  });

  // Truncate location to venue name for info cards (first line or first comma segment)
  eleventyConfig.addFilter("truncateLocation", function(value) {
    if (!value) return '';
    var text = String(value);
    // If multi-line (from API), take first line
    if (text.includes('\n')) return text.split('\n')[0].trim();
    // If comma-separated, take first segment (venue name)
    var parts = text.split(',');
    if (parts.length > 2) return parts[0].trim();
    return text;
  });

  // Cache-busting version string (changes each build)
  eleventyConfig.addGlobalData("cacheBust", Date.now().toString(36));

  // Cloudflare Turnstile site key (public — safe to embed in HTML)
  eleventyConfig.addGlobalData("turnstileSiteKey", "0x4AAAAAACy7v5xPWzocdnb-");

  return {
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes",
      layouts: "_includes/layouts"
    },
    templateFormats: ["md", "html", "njk"],
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk"
  };
};

module.exports.chapterSlugFromUrl = chapterSlugFromUrl;
