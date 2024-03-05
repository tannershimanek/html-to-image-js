const { toArray } = require("./util");
const { fetchAsDataURL } = require("./dataurl");
const { shouldEmbed, embedResources } = require("./embed-resources");

// Removed interface Metadata, and represent it as a comment:
// Metadata: { url: string, cssText: string }
const cssFetchCache = {};

/**
 * Fetches CSS from a specified URL and caches the response.
 *
 * This asynchronous function fetches CSS text from the given URL. If the CSS text has been fetched previously,
 * it returns the cached response to avoid redundant network requests. Otherwise, it performs a fetch request,
 * stores the response in a cache, and then returns the fetched CSS text along with the URL from which it was fetched.
 * This caching mechanism improves performance by reducing duplicate fetch operations for the same resource.
 *
 * @async
 * @param {string} url - The URL from which to fetch the CSS text.
 * @returns {Promise<Object>} A promise that resolves to an object containing the URL and the fetched CSS text.
 */
async function fetchCSS(url) {
  let cache = cssFetchCache[url];
  if (cache != null) {
    return cache;
  }

  const res = await fetch(url);
  const cssText = await res.text();
  cache = { url, cssText };

  cssFetchCache[url] = cache;

  return cache;
}

/**
 * Embeds font resources found in CSS text as data URLs.
 *
 * This function processes CSS text to identify font resources referenced via `url()` functions.
 * For each font resource URL found, the function attempts to fetch the resource and embed it directly
 * into the CSS text as a data URL. This process converts external font references into embedded data URLs,
 * making the CSS self-contained and eliminating dependencies on external font files.
 *
 * The function supports resolving relative URLs based on the location of the CSS file, converting them into
 * absolute URLs when necessary. It also allows for custom fetch initialization settings to be passed via
 * `options.fetchRequestInit`, providing flexibility in how the font resources are fetched (e.g., custom headers).
 *
 * @async
 * @param {Object} data - An object containing the CSS text (`cssText`) and the base URL (`url`) of the CSS file.
 * @param {Object} options - Options to configure the fetch request, including `fetchRequestInit` for custom fetch settings.
 * @returns {Promise<string>} A promise that resolves to the CSS text with all font resources embedded as data URLs.
 */
async function embedFonts(data, options) {
  let cssText = data.cssText;
  const regexUrl = /url\(["']?([^"')]+)["']?\)/g;
  const fontLocs = cssText.match(/url\([^)]+\)/g) || [];
  const loadFonts = fontLocs.map(async (loc) => {
    let url = loc.replace(regexUrl, "$1");
    if (!url.startsWith("https://")) {
      url = new URL(url, data.url).href;
    }

    return fetchAsDataURL(url, options.fetchRequestInit, ({ result }) => {
      cssText = cssText.replace(loc, `url(${result})`);
      return [loc, result];
    });
  });

  return Promise.all(loadFonts).then(() => cssText);
}

/**
 * Parses CSS text to extract keyframes, @import rules, and other CSS rules, excluding comments.
 *
 * This function takes a string containing CSS and parses it to extract various components such as keyframes animations,
 * @import rules, and other CSS rules including media queries. Comments within the CSS are removed as part of the parsing process
 * to ensure they do not interfere with the extraction of valid CSS rules. The function employs regular expressions to identify
 * and separate these components into individual strings, which are then collected into an array.
 *
 * The parsing process specifically targets:
 * - Keyframes animations, identified by `@keyframes` declarations.
 * - @import rules that import other stylesheets.
 * - Other CSS rules, including those encapsulated within media queries.
 *
 * Each matched rule or declaration is pushed into a result array as a separate string. This array is then returned, providing
 * a structured representation of the CSS content that can be further processed or manipulated as needed.
 *
 * Note: The function assumes that the input CSS text is a well-formed CSS string. Malformed CSS might result in unpredictable
 * parsing outcomes.
 *
 * @param {string|null|undefined} source - The CSS text to be parsed.
 * @returns {string[]} An array of strings, each representing a distinct CSS rule or declaration extracted from the input CSS text.
 */
function parseCSS(source) {
  if (source == null) {
    return [];
  }

  const result = [];
  const commentsRegex = /(\/\*[\s\S]*?\*\/)/gi;
  let cssText = source.replace(commentsRegex, "");
  const keyframesRegex = new RegExp(
    "((@.*?keyframes [\\s\\S]*?){([\\s\\S]*?}\\s*?)})",
    "gi"
  );

  while (true) {
    const matches = keyframesRegex.exec(cssText);
    if (matches === null) {
      break;
    }
    result.push(matches[0]);
  }
  cssText = cssText.replace(keyframesRegex, "");

  const importRegex = /@import[\s\S]*?url\([^)]*\)[\s\S]*?;/gi;
  const combinedCSSRegex =
    "((\\s*?(?:\\/\\*[\\s\\S]*?\\*\\/)?\\s*?@media[\\s\\S]" +
    "*?){([\\s\\S]*?)}\\s*?})|(([\\s\\S]*?){([\\s\\S]*?)})";
  const unifiedRegex = new RegExp(combinedCSSRegex, "gi");

  while (true) {
    let matches = importRegex.exec(cssText);
    if (matches === null) {
      matches = unifiedRegex.exec(cssText);
      if (matches === null) {
        break;
      } else {
        importRegex.lastIndex = unifiedRegex.lastIndex;
      }
    } else {
      unifiedRegex.lastIndex = importRegex.lastIndex;
    }
    result.push(matches[0]);
  }

  return result;
}

/**
 * Asynchronously retrieves and processes CSS rules from a list of stylesheets, embedding any external fonts.
 *
 * This function iterates over an array of stylesheet objects, attempting to process each one to extract its CSS rules.
 * For stylesheets containing @import rules, it fetches the imported CSS, embeds any fonts referenced within using data URLs,
 * and inserts the resulting CSS rules back into the stylesheet. This process also applies to stylesheets referenced via href attributes;
 * it fetches these stylesheets, embeds fonts, and inserts the processed CSS rules. The function handles errors gracefully, logging them
 * and continuing with the next stylesheet if possible.
 *
 * The main steps for each stylesheet include:
 * 1. Checking for CSSRule.IMPORT_RULE types and fetching the imported stylesheets.
 * 2. Embedding fonts within fetched CSS and parsing it to individual CSS rules.
 * 3. Inserting parsed CSS rules back into the original stylesheet or an inline stylesheet if errors occur.
 *
 * After processing all stylesheets, the function collects and returns all CSS rules from the processed stylesheets. This comprehensive
 * approach allows the inclusion of external CSS resources and fonts directly within the document, enhancing rendering consistency and
 * reducing external dependencies.
 *
 * @async
 * @param {StyleSheetList|Array} styleSheets - An array-like object of stylesheets to process.
 * @param {Object} options - Options for configuring the fetching and embedding processes, such as CORS settings.
 * @returns {Promise<Array>} A promise that resolves to an array of CSSRule objects representing the aggregated CSS rules from all processed stylesheets.
 */
async function getCSSRules(styleSheets, options) {
  const ret = [];
  const deferreds = [];

  styleSheets.forEach((sheet) => {
    if ("cssRules" in sheet) {
      try {
        toArray(sheet.cssRules || []).forEach((item, index) => {
          if (item.type === CSSRule.IMPORT_RULE) {
            let importIndex = index + 1;
            const url = item.href;
            const deferred = fetchCSS(url)
              .then((metadata) => embedFonts(metadata, options))
              .then((cssText) =>
                parseCSS(cssText).forEach((rule) => {
                  try {
                    sheet.insertRule(
                      rule,
                      rule.startsWith("@import")
                        ? (importIndex += 1)
                        : sheet.cssRules.length
                    );
                  } catch (error) {
                    console.error("Error inserting rule from remote css", {
                      rule,
                      error,
                    });
                  }
                })
              )
              .catch((e) => {
                console.error("Error loading remote css", e.toString());
              });

            deferreds.push(deferred);
          }
        });
      } catch (e) {
        const inline =
          styleSheets.find((a) => a.href == null) || document.styleSheets[0];
        if (sheet.href != null) {
          deferreds.push(
            fetchCSS(sheet.href)
              .then((metadata) => embedFonts(metadata, options))
              .then((cssText) =>
                parseCSS(cssText).forEach((rule) => {
                  inline.insertRule(rule, sheet.cssRules.length);
                })
              )
              .catch((err) => {
                console.error("Error loading remote stylesheet", err);
              })
          );
        }
        console.error("Error inlining remote css file", e);
      }
    }
  });

  return Promise.all(deferreds).then(() => {
    styleSheets.forEach((sheet) => {
      if ("cssRules" in sheet) {
        try {
          toArray(sheet.cssRules || []).forEach((item) => {
            ret.push(item);
          });
        } catch (e) {
          console.error(`Error while reading CSS rules from ${sheet.href}`, e);
        }
      }
    });

    return ret;
  });
}

/**
 * Filters CSS rules to return only web font (@font-face) rules that have embeddable resources.
 *
 * This function takes an array of CSSRule objects and filters it to include only those rules that are
 * font-face declarations (CSSRule.FONT_FACE_RULE) and contain sources (defined in the 'src' property)
 * that should be embedded (as determined by shouldEmbed function). This is useful for identifying and
 * processing web font declarations that reference external font files, enabling their potential
 * embedding directly within CSS text.
 *
 * @param {CSSRule[]} cssRules - An array of CSSRule objects to filter.
 * @returns {CSSRule[]} An array of CSSRule objects that represent @font-face declarations with embeddable sources.
 */
function getWebFontRules(cssRules) {
  return cssRules
    .filter((rule) => rule.type === CSSRule.FONT_FACE_RULE)
    .filter((rule) => shouldEmbed(rule.style.getPropertyValue("src")));
}

/**
 * Asynchronously parses a DOM node to find and return all web font (@font-face) CSS rules.
 *
 * This function extracts all CSS rules from the stylesheets associated with the document of the provided node,
 * then filters these rules to return only the web font (@font-face) rules that reference embeddable resources.
 * It leverages getCSSRules to aggregate and process CSS rules from all stylesheets and getWebFontRules to filter
 * down to the relevant @font-face rules. This is part of a process aimed at embedding the fonts directly into the
 * CSS to ensure web fonts are available without requiring external requests, enhancing performance and rendering consistency.
 *
 * @async
 * @param {Node} node - The DOM node whose document's stylesheets will be parsed for @font-face rules.
 * @param {Object} options - Configuration options for fetching and embedding font resources.
 * @returns {Promise<CSSRule[]>} A promise that resolves to an array of @font-face CSSRule objects with embeddable resources.
 * @throws {Error} If the provided node is not within a document.
 */
async function parseWebFontRules(node, options) {
  if (node.ownerDocument == null) {
    throw new Error("Provided element is not within a Document");
  }

  const styleSheets = toArray(node.ownerDocument.styleSheets);
  const cssRules = await getCSSRules(styleSheets, options);

  return getWebFontRules(cssRules);
}

/**
 * Asynchronously generates a single CSS text string containing all embeddable web font (@font-face) rules for a given DOM node.
 *
 * This function first identifies all @font-face rules associated with the provided node's document, then attempts to embed
 * the resources referenced in these rules directly within the CSS text. Each font-face rule is processed to replace its 'src'
 * URLs with data URLs where feasible, consolidating all resulting CSS text into a single string. This approach is intended to
 * optimize web font loading by embedding fonts directly in the CSS, thereby reducing external requests and improving web font
 * availability and rendering speed.
 *
 * @async
 * @param {Node} node - The DOM node for which to generate embedded web font CSS.
 * @param {Object} options - Configuration options that influence how resources are fetched and embedded.
 * @returns {Promise<string>} A promise that resolves to a string of CSS text containing all embeddable @font-face rules.
 */
async function getWebFontCSS(node, options) {
  const rules = await parseWebFontRules(node, options);
  const cssTexts = await Promise.all(
    rules.map((rule) => {
      const baseUrl = rule.parentStyleSheet ? rule.parentStyleSheet.href : null;
      return embedResources(rule.cssText, baseUrl, options);
    })
  );

  return cssTexts.join("\n");
}

/**
 * Asynchronously embeds web fonts into a cloned DOM node by injecting a `<style>` element with CSS rules.
 *
 * This function is designed to enhance the self-contained nature of a cloned DOM subtree by ensuring that any
 * web fonts used within the subtree are embedded directly into it, rather than relying on external stylesheet
 * references. It does this by either using a provided string of CSS rules (`fontEmbedCSS` option) or, unless
 * font embedding is skipped (`skipFonts` option), by dynamically generating CSS rules for web fonts referenced
 * within the subtree's stylesheets. These CSS rules are then injected into the cloned node as a `<style>` element
 * at the beginning of the node's child list. This approach aims to preserve the visual fidelity of the cloned
 * subtree, particularly when it is used in contexts where external web font stylesheets might not be available or
 * desired.
 *
 * @async
 * @param {Node} clonedNode - The cloned DOM node into which web fonts will be embedded.
 * @param {Object} options - Configuration options for the embedding process. Relevant properties include:
 *                           `fontEmbedCSS` (string|null) - A string of CSS rules for web fonts to be embedded, or null to dynamically generate them.
 *                           `skipFonts` (boolean) - Whether to skip the embedding of web fonts altogether.
 * @returns {Promise<void>} A promise that resolves when the embedding process is complete.
 */
async function embedWebFonts(clonedNode, options) {
  let cssText =
    options.fontEmbedCSS !== null
      ? options.fontEmbedCSS
      : options.skipFonts
      ? null
      : await getWebFontCSS(clonedNode, options);

  if (cssText) {
    const styleNode = document.createElement("style");
    const sytleContent = document.createTextNode(cssText);

    styleNode.appendChild(sytleContent);

    if (clonedNode.firstChild) {
      clonedNode.insertBefore(styleNode, clonedNode.firstChild);
    } else {
      clonedNode.appendChild(styleNode);
    }
  }
}

module.exports = {
  embedWebFonts,
  getWebFontCSS,
};
