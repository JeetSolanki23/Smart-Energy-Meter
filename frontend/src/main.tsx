import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

const enforceFavicon = () => {
	const href = '/sem-favicon.ico?v=1';
	const existingIcons = document.querySelectorAll("link[rel='icon'], link[rel='shortcut icon']");
	existingIcons.forEach((node) => node.parentNode?.removeChild(node));

	const icon = document.createElement('link');
	icon.setAttribute('rel', 'icon');
	icon.setAttribute('type', 'image/x-icon');
	icon.setAttribute('href', href);

	const shortcut = document.createElement('link');
	shortcut.setAttribute('rel', 'shortcut icon');
	shortcut.setAttribute('href', href);

	document.head.appendChild(icon);
	document.head.appendChild(shortcut);
};

enforceFavicon();

createRoot(document.getElementById("root")!).render(<App />);
