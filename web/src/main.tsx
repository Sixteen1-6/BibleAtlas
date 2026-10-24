// First: the boot sky hand-off, offline support and update notices.
import './arrival';
import { render } from 'preact';
import '@fontsource/instrument-sans/latin-400.css';
import '@fontsource/instrument-sans/latin-600.css';
import '@fontsource/literata/latin-400.css';
import '@fontsource/literata/latin-400-italic.css';
import '@fontsource/literata/latin-600.css';
import '@fontsource/noto-serif-hebrew/hebrew-400.css';
import '@fontsource/noto-serif/greek-400.css';
import '@fontsource/noto-serif/greek-ext-400.css';
import './styles.css';
import { App } from './App';
import { ErrorBoundary } from './boot/ErrorBoundary';
import { NoticeHost } from './ui/commentary/Gate';

render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
  document.getElementById('app')!,
);

// The commentary notice, outside #app: the phone panel sets #app inert.
render(<NoticeHost />, document.body.appendChild(document.createElement('div')));
