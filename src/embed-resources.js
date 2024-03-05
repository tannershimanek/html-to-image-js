const util = require("./util");
const mimes = require("./mimes");
const dataurl = require("./dataurl");

const URL_REGEX = /url\((['"]?)([^'"]+?)\1\)/g;
const URL_WITH_FORMAT_REGEX = /url\([^)]+\)\s*format\((["']?)([^"']+)\1\)/g;
const FONT_SRC_REGEX = /src:\s*(?:url\([^)]+\)\s*format\([^)]+\)[,;]\s*)+/g;

/**
 * Escapes a URL and returns a regular expression to match CSS url() patterns containing the escaped URL.
 *
 * This function takes a URL string as input, escapes special characters in the string that have significance in regular expressions,
 * and constructs a RegExp object designed to match the CSS `url()` pattern where the URL appears. This includes handling for
 * optional single or double quotes within the `url()` pattern. The resulting RegExp can be used to search CSS text for specific
 * instances of the URL within `url()` functions.
 *
 * @param {string} url - The URL to be escaped and converted into a regular expression.
 * @returns {RegExp} A RegExp object that matches the CSS `url()` pattern containing the escaped URL.
 */
function toRegex(url) {
  const escaped = url.replace(/([.*+?^${}()|\[\]\/\\])/g, "\\$1");
  return new RegExp(`(url\\(['"]?)(${escaped})(['"]?\\))`, "g");
}

/**
 * Extracts and returns non-data URL references from CSS text.
 *
 * This function scans a string of CSS text for URL references (using a predefined `URL_REGEX` to match CSS `url()` patterns)
 * and extracts the URLs found within these patterns. It filters out any URLs that are already encoded as data URLs, returning
 * only those URLs that point to external resources. This can be useful for processing CSS to identify, modify, or preload
 * external resources referenced within the CSS.
 *
 * Note: The `URL_REGEX` used must be defined elsewhere and should be capable of matching CSS `url()` patterns, capturing
 * the URL itself for extraction.
 *
 * @param {string} cssText - The CSS text from which to extract URLs.
 * @returns {string[]} An array of URL strings extracted from the CSS text, excluding data URLs.
 */
function parseURLs(cssText) {
  const urls = [];

  cssText.replace(URL_REGEX, (raw, quotation, url) => {
    urls.push(url);
    return raw;
  });

  return urls.filter((url) => !dataurl.isDataUrl(url));
}

/**
 * Asynchronously embeds a single resource into CSS text by converting it to a data URL.
 *
 * This function attempts to replace a specified URL in CSS text with a data URL representation of the resource. It resolves the
 * resource URL against an optional base URL, determines the MIME type using a MIME type lookup function, fetches the resource, and
 * then converts the resource content to a data URL. This data URL is then used to replace references to the resource URL in the
 * original CSS text. If an optional `getContentFromUrl` function is provided, it is used to fetch the resource content instead of
 * the default fetching mechanism. The function gracefully handles any errors by returning the original CSS text unmodified.
 *
 * @async
 * @param {string} cssText - The CSS text containing the URL to be embedded.
 * @param {string} resourceURL - The URL of the resource to embed.
 * @param {string} [baseURL] - An optional base URL to resolve relative resource URLs.
 * @param {Object} options - Options for fetching the resource and converting it to a data URL.
 * @param {Function} getContentFromUrl - An optional function to fetch the resource content, receiving the resolved URL as an argument.
 * @returns {Promise<string>} The CSS text with the specified URL replaced by the corresponding data URL.
 */
async function embed(
  cssText,
  resourceURL,
  baseURL,
  options,
  getContentFromUrl
) {
  try {
    const resolvedURL = baseURL
      ? util.resolveUrl(resourceURL, baseURL)
      : resourceURL;
    const contentType = mimes.getMimeType(resourceURL);
    let dataURL;
    if (getContentFromUrl) {
      const content = await getContentFromUrl(resolvedURL);
      dataURL = dataurl.makeDataUrl(content, contentType);
    } else {
      dataURL = await dataurl.resourceToDataURL(
        resolvedURL,
        contentType,
        options
      );
    }
    return cssText.replace(toRegex(resourceURL), `$1${dataURL}$3`);
  } catch (error) {
    // pass
  }
  return cssText;
}

/**
 * Filters CSS text to retain only the specified font format within @font-face src declarations.
 *
 * This function processes CSS text to selectively keep @font-face src declarations that match a preferred font format (e.g., 'woff2',
 * 'truetype'). It effectively parses the CSS text, identifies @font-face src declarations, and filters these declarations based on
 * the specified format, removing those that do not match. This allows for the reduction of CSS text size and the optimization of
 * font loading by excluding formats that are not needed or supported.
 *
 * @param {string} str - The CSS text to filter.
 * @param {Object} options - An object containing the preferred font format under the `preferredFontFormat` key.
 * @returns {string} The filtered CSS text, containing only @font-face src declarations that match the preferred font format.
 */
function filterPreferredFontFormat(str, { preferredFontFormat }) {
  return !preferredFontFormat
    ? str
    : str.replace(FONT_SRC_REGEX, (match) => {
        while (true) {
          const [src, , format] = URL_WITH_FORMAT_REGEX.exec(match) || [];
          if (!format) {
            return "";
          }

          if (format === preferredFontFormat) {
            return `src: ${src};`;
          }
        }
      });
}

/**
 * Determines if the given CSS text contains any URLs that should be embedded.
 *
 * This function checks if the provided CSS text contains any URLs that match a predefined
 * URL pattern (URL_REGEX). The intention is to identify CSS strings that reference external
 * resources, indicating whether further processing (such as embedding these resources) is necessary.
 *
 * @param {string} url - The CSS text to be examined for URLs.
 * @returns {boolean} True if the CSS text contains URLs matching the pattern, false otherwise.
 */
function shouldEmbed(url) {
  return url.search(URL_REGEX) !== -1;
}

/**
 * Asynchronously embeds external resources within CSS text.
 *
 * This function processes CSS text to find and replace all external resource URLs with embedded
 * data URLs. It first checks if there are any URLs to embed using `shouldEmbed`. If not, it returns
 * the original CSS text. Otherwise, it filters the CSS to only include rules for the preferred font
 * format specified in `options`, extracts all relevant URLs using `parseURLs`, and then sequentially
 * embeds each resource found at those URLs into the CSS text. This embedding converts each external
 * resource URL into a data URL and replaces its reference in the CSS with this data URL, making the
 * CSS self-contained.
 *
 * The function utilizes a `filterPreferredFontFormat` to optionally filter the CSS text based on a
 * preferred font format before extracting and embedding URLs, allowing for optimization of the
 * embedded resources according to specific criteria (e.g., font formats).
 *
 * @async
 * @param {string} cssText - The CSS text containing URLs of external resources to be embedded.
 * @param {string} baseUrl - The base URL to resolve relative resource URLs against.
 * @param {Object} options - Options for controlling the embedding process, including preferences for font formats.
 * @returns {Promise<string>} A promise that resolves to the CSS text with all applicable external resources embedded as data URLs.
 */
async function embedResources(cssText, baseUrl, options) {
  if (!shouldEmbed(cssText)) {
    return cssText;
  }

  const filteredCSSText = filterPreferredFontFormat(cssText, options);
  const urls = parseURLs(filteredCSSText);
  return urls.reduce(
    (deferred, url) =>
      deferred.then((css) => embed(css, url, baseUrl, options)),
    Promise.resolve(filteredCSSText)
  );
}

module.exports = {
  embed,
  parseURLs,
  shouldEmbed,
  embedResources,
};
