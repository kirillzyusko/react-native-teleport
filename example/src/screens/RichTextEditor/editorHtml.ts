export const EDITOR_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <link href="https://cdn.quilljs.com/1.3.7/quill.snow.css" rel="stylesheet">
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    .ql-toolbar {
      border-left: none !important;
      border-right: none !important;
      border-top: none !important;
      background: #fafafa;
    }
    .ql-container {
      border: none !important;
      font-size: 16px;
    }
    .ql-editor {
      padding: 16px;
      min-height: 300px;
    }
  </style>
</head>
<body>
  <div id="editor">
    <h2>Welcome to the Editor</h2>
    <p>This rich text editor was loaded inside a <strong>WebView</strong>. It uses <a href="https://quilljs.com">Quill</a> &mdash; a modern WYSIWYG editor.</p>
    <p>The editor's JavaScript and CSS were fetched from a CDN, parsed, and initialized &mdash; all of which takes time.</p>
    <p>With <strong>react-native-teleport</strong>, this work happened <em>offscreen</em> while the user was on another screen. When the editor is needed, it teleports in instantly.</p>
    <p><br></p>
    <p>Try editing this text, applying <strong>bold</strong>, <em>italic</em>, or <u>underline</u> formatting!</p>
  </div>
  <script src="https://cdn.quilljs.com/1.3.7/quill.min.js"><\/script>
  <script>
    var quill = new Quill('#editor', {
      theme: 'snow',
      modules: {
        toolbar: [
          [{ header: [1, 2, 3, false] }],
          ['bold', 'italic', 'underline', 'strike'],
          [{ list: 'ordered' }, { list: 'bullet' }],
          ['link', 'blockquote', 'code-block'],
          ['clean']
        ]
      }
    });
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
    }
  </script>
</body>
</html>`;
