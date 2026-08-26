// messages.ts
// Stałe historii czatu (długość, page size, wirtualizacja).
// Zakres:
//  - progi MessageList i cache stron
//  - max długość, page size, progi wirtualizacji listy
// Page size musi być ten sam co getMessages na serwerze.
// Przy zmianach: api/messages.ts, MessageList.tsx, messageCache.ts.

export const MAX_MESSAGE_LENGTH = 2000;

export const MESSAGE_PAGE_SIZE = 30;
