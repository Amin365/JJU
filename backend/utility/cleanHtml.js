
export default function cleanHtml(html = "") {
  return html
    // Replace &nbsp; with real spaces
    .replace(/&nbsp;/g, " ")

    // Remove empty paragraphs and tags
    .replace(/<p>\s*<\/p>/g, "")
    .replace(/<br\s*\/?>\s*<br\s*\/?>/g, "<br>")

    // Remove excessive whitespace between tags
    .replace(/\s+</g, "<")
    .replace(/>\s+/g, ">")

    // Trim final result
    .trim();
}
