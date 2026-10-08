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

render(<App />, document.getElementById('app')!);
