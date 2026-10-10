import { useStore } from './client/src/state/useStore.js';

// Wait, I can't import Zustand store in raw Node if it's not compiled,
// but I can read the source of useStore.js and pipeline.js.
