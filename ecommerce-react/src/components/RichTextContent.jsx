import { useMemo } from 'react';

function sanitize(html) {
  const documentNode = new DOMParser().parseFromString(html || '', 'text/html');
  documentNode.querySelectorAll('script, style, iframe, object, embed, form').forEach((node) => node.remove());
  documentNode.querySelectorAll('*').forEach((node) => {
    [...node.attributes].forEach((attribute) => {
      if (attribute.name.toLowerCase().startsWith('on') || attribute.name.toLowerCase() === 'style') {
        node.removeAttribute(attribute.name);
      }
      if ((attribute.name === 'href' || attribute.name === 'src') && /^javascript:/i.test(attribute.value.trim())) {
        node.removeAttribute(attribute.name);
      }
    });
  });
  return documentNode.body.innerHTML;
}

export default function RichTextContent({ html, className }) {
  const safeHtml = useMemo(() => sanitize(html), [html]);
  return <div className={className} dangerouslySetInnerHTML={{ __html: safeHtml }} />;
}
