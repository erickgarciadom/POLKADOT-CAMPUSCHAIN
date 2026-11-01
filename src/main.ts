import './styles.css';
import { createHub } from './hub/hub';
import { mountApp } from './ui/app';

const root = document.getElementById('app')!;
const hub = createHub();
mountApp(root, hub);
void hub.start();
