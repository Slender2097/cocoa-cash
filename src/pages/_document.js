// src/pages/_document.jsx
/*import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="en">
      <Head />
      <body className="antialiased bg-gray-50">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}*/

// src/pages/_document.jsx
import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <link rel="icon" href="/favicon.png" />
        {/* Optional: better quality for different devices */}
        <link rel="apple-touch-icon" href="/jaguar-logo.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/jaguar-logo.png" />
      </Head>
      <body className="antialiased">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}