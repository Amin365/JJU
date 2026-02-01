export default function cleanQuillHtml(html = "") {
  if (typeof html !== "string") return "";

  // 1) Preserve Quill blank paragraphs: <p><br></p> -> <p>&nbsp;</p>
  // This prevents the "space between paragraphs" from being removed later.
  let out = html.replace(/<p>\s*<br\s*\/?>\s*<\/p>/gi, "<p>&nbsp;</p>");

  // 2) Remove truly empty paragraphs only (NOT &nbsp;)
  out = out.replace(/<p>\s*<\/p>/gi, "");

  // 3) Keep &nbsp; as-is (DO NOT convert it to normal spaces)

  return out.trim();
}