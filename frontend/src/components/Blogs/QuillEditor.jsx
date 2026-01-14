import React, { useCallback, useEffect, useRef, useState } from "react"
import ReactQuill from "react-quill-new"
import "react-quill-new/dist/quill.snow.css"

const QuillEditor = ({
  value = "",
  onChange,
  placeholder = "Write your content...",
  className = "",
  height = 400,
}) => {
  const quillRef = useRef(null)
  const [editorValue, setEditorValue] = useState(value)

  // Sync external value with editor
  useEffect(() => {
    setEditorValue(value || "")
  }, [value])

  // Handle editor change
  const handleChange = useCallback(
    (content) => {
      setEditorValue(content)
      onChange?.(content)
    },
    [onChange]
  )

  // Toolbar configuration (Word-like)
  const modules = {
    toolbar: [
      [{ font: [] }, { size: [] }],
      ["bold", "italic", "underline", "strike"],
      [{ color: [] }, { background: [] }],
      [{ script: "sub" }, { script: "super" }],
      [{ header: 1 }, { header: 2 }],
      [{ list: "ordered" }, { list: "bullet" }],
      [{ indent: "-1" }, { indent: "+1" }],
      [{ align: [] }],
      ["link", "image", "video"],
      ["blockquote", "code-block"],
       [{ imageSize: ["small", "medium", "large", "full"] }],
      ["clean"],
    ],
  }

  // Allowed formats
  const formats = [
    "font",
    "size",
    "bold",
    "italic",
    "underline",
    "strike",
    "color",
    "background",
    "script",
    "header",
    "list",
    "bullet",
    "indent",
    "align",
    "link",
    "image",
    "video",
    "blockquote",
    "code-block",
     "imageSize",
  ]

  return (
    <div className={className} style={{ height }}>
      <ReactQuill
        ref={quillRef}
        theme="snow"
        value={editorValue}
        onChange={handleChange}
        placeholder={placeholder}
        modules={modules}
        formats={formats}
        style={{ height: height - 42 }}
      />
    </div>
  )
}

export default QuillEditor
