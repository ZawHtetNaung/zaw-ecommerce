import { useEffect, useRef } from 'react';

const commands = [
  ['bold', 'Bold'],
  ['italic', 'Italic'],
  ['underline', 'Underline'],
  ['insertUnorderedList', 'Bullets'],
  ['insertOrderedList', 'Numbered'],
];

export default function RichTextEditor({ label, value, onChange, minHeight = 160 }) {
  const editorRef = useRef(null);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== (value || '')) {
      editorRef.current.innerHTML = value || '';
    }
  }, [value]);

  function runCommand(command, commandValue = null) {
    editorRef.current?.focus();
    document.execCommand(command, false, commandValue);
    onChange(editorRef.current?.innerHTML || '');
  }

  function addLink() {
    const url = window.prompt('Enter the link URL (https://...)');
    if (!url) return;
    const normalizedUrl = /^(https?:\/\/|mailto:|tel:|\/)/i.test(url.trim()) ? url.trim() : `https://${url.trim()}`;
    runCommand('createLink', normalizedUrl);
  }

  return (
    <div className="rich-text-field">
      {label && <label className="form-label">{label}</label>}
      <div className="btn-toolbar gap-1 border rounded-top p-2 bg-body-tertiary" role="toolbar" aria-label={`${label || 'Text'} formatting`}>
        {commands.map(([command, text]) => (
          <button key={command} type="button" className="btn btn-sm btn-outline-secondary" onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand(command)}>{text}</button>
        ))}
        <select
          className="form-select form-select-sm"
          style={{ width: 135 }}
          defaultValue=""
          aria-label="Heading type"
          onChange={(event) => {
            if (event.target.value) runCommand('formatBlock', event.target.value);
            event.target.value = '';
          }}
        >
          <option value="" disabled>Heading type</option>
          <option value="p">Paragraph</option>
          <option value="h1">Heading 1</option>
          <option value="h2">Heading 2</option>
          <option value="h3">Heading 3</option>
          <option value="h4">Heading 4</option>
          <option value="h5">Heading 5</option>
          <option value="h6">Heading 6</option>
        </select>
        <button type="button" className="btn btn-sm btn-outline-secondary" onMouseDown={(event) => event.preventDefault()} onClick={addLink}>Insert Link</button>
        <button type="button" className="btn btn-sm btn-outline-secondary" onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand('unlink')}>Remove Link</button>
        <button type="button" className="btn btn-sm btn-outline-secondary" onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand('removeFormat')}>Clear formatting</button>
      </div>
      <div
        ref={editorRef}
        className="form-control rounded-top-0 overflow-auto"
        contentEditable
        suppressContentEditableWarning
        style={{ minHeight }}
        onInput={(event) => onChange(event.currentTarget.innerHTML)}
      />
    </div>
  );
}
