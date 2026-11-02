/**
 * Playground shell: hash routes so the static build works anywhere (GitHub Pages etc).
 *  #/          Home (landing)           – studio/
 *  #/studio    Animation studio         – studio/
 *  #/gallery   Emotions & poses gallery – studio/
 *  #/examples  Integration examples     – examples/
 *  #/app       old app showcase URL, redirects to #/examples
 */
import { useEffect, useState, type ReactElement } from "react";
import { Home } from './studio/Home';
import { Studio } from './studio/Studio';
import { Gallery } from './studio/Gallery';
import { Examples } from './examples/Examples';

const routes: Record<string, { label: string; el: () => ReactElement }> = {
  '/': { label: 'Home', el: Home },
  '/studio': { label: 'Studio', el: Studio },
  '/gallery': { label: 'Gallery', el: Gallery },
  '/examples': { label: 'Examples', el: Examples },
};

function useHashRoute() {
  const get = () => (location.hash.replace(/^#/, '') || '/').split('?')[0];
  const [route, setRoute] = useState(get);
  useEffect(() => {
    const on = () => setRoute(get());
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);
  return route;
}

export function App() {
  const route = useHashRoute();
  // The Echo app showcase moved into the Echo app itself; keep old links working.
  useEffect(() => {
    if (route === '/app') location.replace('#/examples');
  }, [route]);
  const Page = (routes[route] ?? routes['/']).el;
  return (
    <>
      <nav className="om-nav">
        <a className="om-brand" href="#/">OpenMascot</a>
        {Object.entries(routes).map(([path, r]) => (
          <a key={path} href={`#${path}`} className={route === path ? 'active' : ''}>
            {r.label}
          </a>
        ))}
        <a className="om-gh" href="https://github.com/jbraunschweiger/openmascot">GitHub</a>
      </nav>
      <main>
        <Page />
      </main>
    </>
  );
}
