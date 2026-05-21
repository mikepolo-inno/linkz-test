const themeBootstrap = `;(function(){try{var k='linkz-theme';var s=localStorage.getItem(k);var t=s==='light'||s==='dark'?s:(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.classList.toggle('dark',t==='dark');document.documentElement.style.colorScheme=t;}catch(e){}})();`;

/**
 * Inline script that resolves the user's preferred theme before React hydrates.
 * Avoids a flash of light theme on first paint and keeps SSR/CSR markup in sync.
 */
export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />;
}
