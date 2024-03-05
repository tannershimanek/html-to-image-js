/**
 * Extracts and returns the content portion from a data URL.
 *
 * This function takes a data URL as input and returns the content portion of the data URL, which is
 * everything after the first comma. Data URLs are typically formatted as "data:[<mediatype>][;base64],<data>",
 * where "<data>" is the part extracted by this function.
 *
 * @param {string} dataURL - The data URL from which to extract the content.
 * @returns {string} The content portion of the data URL.
 */
function getContentFromDataUrl(dataURL) {
  return dataURL.split(/,/)[1];
}

/**
 * Checks whether a given URL is a data URL.
 *
 * This function determines if the provided URL string is a data URL by checking if it starts with
 * the "data:" scheme. Data URLs are used to include data items inline, such as images in HTML or CSS files,
 * by encoding the file's contents as a base64 or URL-encoded string preceded by "data:".
 *
 * @param {string} url - The URL to be tested.
 * @returns {boolean} True if the URL is a data URL, false otherwise.
 */
function isDataUrl(url) {
  return url.search(/^(data:)/) !== -1;
}

/**
 * Creates a data URL from given content and MIME type.
 *
 * This function generates a data URL by encoding the provided content into a format that can be
 * embedded directly within web documents or stylesheets. The resulting data URL includes the MIME
 * type, an indication of whether the content is base64 encoded, and the content itself.
 *
 * @param {string} content - The content to be encoded in the data URL.
 * @param {string} mimeType - The MIME type of the content.
 * @returns {string} The formatted data URL.
 */
function makeDataUrl(content, mimeType) {
  return `data:${mimeType};base64,${content}`;
}

/**
 * Fetches a resource from the specified URL and returns its content encoded as a data URL.
 *
 * This asynchronous function uses the Fetch API to retrieve a resource from the given URL. If the fetch operation
 * is successful, the response is converted to a Blob, which is then read as a data URL using a FileReader. The
 * `process` callback function is invoked with an object containing the fetch response and the data URL, allowing
 * for custom processing of the fetched resource before resolving the promise with the processed result. If the
 * resource is not found (404 status), an error is thrown. Any error in reading the Blob or processing the result
 * rejects the promise.
 *
 * @async
 * @param {string} url - The URL of the resource to fetch.
 * @param {Object} init - Fetch initialization parameters (e.g., method, headers).
 * @param {Function} process - A callback function that processes the fetch response and data URL.
 * @returns {Promise<*>} A promise that resolves with the processed result of the fetch operation.
 * @throws {Error} If the resource is not found or if an error occurs during fetching, reading, or processing.
 */
async function fetchAsDataURL(url, init, process) {
  const res = await fetch(url, init);
  if (res.status === 404) {
    throw new Error(`Resource "${res.url}" not found`);
  }
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onloadend = () => {
      try {
        resolve(process({ res, result: reader.result }));
      } catch (error) {
        reject(error);
      }
    };

    reader.readAsDataURL(blob);
  });
}

const cache = {};

/**
 * Generates a cache key based on the URL, content type, and a flag indicating whether query parameters should be included.
 *
 * This function creates a cache key for storing fetched resources. By default, the cache key is the URL stripped of its
 * query parameters unless `includeQueryParams` is true, in which case the full URL is used. Additionally, if the resource
 * is a font file (determined by the file extension), the cache key is further simplified to just the file name. The cache
 * key can be prefixed with the content type in square brackets if `contentType` is provided. This mechanism allows for
 * nuanced control over cache key generation, accommodating different caching strategies based on resource type and content.
 *
 * @param {string} url - The URL of the resource.
 * @param {string} [contentType] - The MIME type of the resource, used as a prefix in the cache key.
 * @param {boolean} [includeQueryParams=false] - Whether to include query parameters in the cache key.
 * @returns {string} The generated cache key.
 */
function getCacheKey(url, contentType, includeQueryParams) {
  let key = url.replace(/\?.*/, "");

  if (includeQueryParams) {
    key = url;
  }

  // font resource
  if (/ttf|otf|eot|woff2?/i.test(key)) {
    key = key.replace(/.*\//, "");
  }

  return contentType ? `[${contentType}]${key}` : key;
}

/**
 * Asynchronously fetches a resource and returns its content encoded as a data URL.
 *
 * This function attempts to fetch the specified resource and encode its content as a data URL. It supports caching of results
 * to avoid redundant network requests. The cache key is generated based on the resource URL, optional content type, and a flag
 * indicating whether to include query parameters. If caching is enabled and the resource has already been fetched, the cached
 * data URL is returned immediately.
 *
 * Cache busting can be enabled through options, appending a timestamp query parameter to the resource URL to ensure the latest
 * version is fetched. The fetched resource is processed to extract its content, optionally adjusting the content type based on
 * the response header if not specified. If the fetch operation fails, an optional image placeholder can be returned as a fallback.
 *
 * Errors during fetching or processing are logged as warnings. The successful data URL or fallback placeholder is then cached and returned.
 *
 * @async
 * @param {string} resourceUrl - The URL of the resource to fetch.
 * @param {string} contentType - The MIME type of the resource, used if the response's Content-Type is unavailable or to override it.
 * @param {Object} options - Configuration options for fetching and processing the resource. Includes cache management and fetch request initialization.
 * @param {boolean} [options.includeQueryParams=false] - Whether to include query parameters in the cache key.
 * @param {boolean} [options.cacheBust=false] - Whether to append a timestamp to the URL to bypass the cache.
 * @param {Object} [options.fetchRequestInit] - Initialization object for the fetch request, such as method and headers.
 * @param {string} [options.imagePlaceholder] - A data URL to return as a fallback if fetching fails.
 * @returns {Promise<string>} A promise that resolves with the data URL of the fetched resource content or a fallback placeholder.
 */
async function resourceToDataURL(resourceUrl, contentType, options) {
  const cacheKey = getCacheKey(
    resourceUrl,
    contentType,
    options.includeQueryParams
  );

  if (cache[cacheKey] != null) {
    return cache[cacheKey];
  }

  if (options.cacheBust) {
    resourceUrl += (/\?/.test(resourceUrl) ? "&" : "?") + new Date().getTime();
  }

  let dataURL;
  try {
    const content = await fetchAsDataURL(
      resourceUrl,
      options.fetchRequestInit,
      ({ res, result }) => {
        if (!contentType) {
          contentType = res.headers.get("Content-Type") || "";
        }
        return getContentFromDataUrl(result);
      }
    );
    dataURL = makeDataUrl(content, contentType);
  } catch (error) {
    dataURL = options.imagePlaceholder || "";

    let msg = `Failed to fetch resource: ${resourceUrl}`;
    if (error) {
      msg = typeof error === "string" ? error : error.message;
    }

    if (msg) {
      console.warn(msg);
    }
  }

  cache[cacheKey] = dataURL;
  return dataURL;
}

module.exports = {
  isDataUrl,
  resourceToDataURL,
};
