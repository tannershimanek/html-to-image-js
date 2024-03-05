const WOFF = "application/font-woff";
const JPEG = "image/jpeg";

const mimes = {
  woff: WOFF,
  woff2: WOFF,
  ttf: "application/font-truetype",
  eot: "application/vnd.ms-fontobject",
  png: "image/png",
  jpg: JPEG,
  jpeg: JPEG,
  gif: "image/gif",
  tiff: "image/tiff",
  svg: "image/svg+xml",
  webp: "image/webp",
};

/**
 * Extracts the file extension from a given URL.
 *
 * This function uses a regular expression to find the last occurrence of a period followed by any characters
 * that are not a period or a forward slash, which is considered to be the file extension. If a match is found,
 * the function returns the extension; otherwise, it returns an empty string. This can be useful for determining
 * the file type of a resource based on its URL.
 *
 * @param {string} url - The URL from which to extract the file extension.
 * @returns {string} The extracted file extension, or an empty string if no extension can be determined.
 */
function getExtension(url) {
  const match = /\.([^./]*?)$/g.exec(url);
  return match ? match[1] : "";
}

/**
 * Determines the MIME type of a resource based on its URL file extension.
 *
 * This function first extracts the file extension from the given URL, converts it to lowercase, and then
 * looks up the corresponding MIME type in a predefined `mimes` object. If the extension is found within
 * the `mimes` object, the function returns the associated MIME type; otherwise, it returns an empty string.
 * This method is particularly useful for setting or checking the content type of resources when the MIME
 * type needs to be inferred from the URL.
 *
 * @param {string} url - The URL of the resource for which to determine the MIME type.
 * @returns {string} The determined MIME type based on the file extension, or an empty string if the MIME type cannot be determined.
 */
function getMimeType(url) {
  const extension = getExtension(url).toLowerCase();
  return mimes[extension] || "";
}

module.exports = {
  getMimeType,
};
