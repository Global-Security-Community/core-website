const crypto = require('crypto');

module.exports = function(eleventyConfig) {
  // Copy static assets
  eleventyConfig.addPassthroughCopy("src/assets");
  eleventyConfig.addPassthroughCopy("src/css");
  eleventyConfig.addPassthroughCopy("src/js");
  eleventyConfig.addPassthroughCopy("src/manifest.json");
  eleventyConfig.addPassthroughCopy("src/sw.js");
  eleventyConfig.addPassthroughCopy("src/.well-known");

  // MD5 hash filter for Gravatar
  eleventyConfig.addFilter("md5", function(value) {
    if (!value) return '';
    return crypto.createHash('md5').update(value.trim().toLowerCase()).digest('hex');
  });

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
