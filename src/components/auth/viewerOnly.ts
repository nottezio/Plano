import { createContext, useContext } from 'react';

/**
 * A "list viewer" account (22 Oct 2026): admitted only to read the List
 * Maker lists it is a member of. Set by AccessGate; the shell and the List
 * Maker read it to drop everything else. The rules enforce the same limit.
 */
export const ViewerOnly = createContext(false);
export const useViewerOnly = (): boolean => useContext(ViewerOnly);
