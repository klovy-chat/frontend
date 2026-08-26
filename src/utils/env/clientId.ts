// clientId.ts
// Stała X-Klovy-Client = KlovyChatApp/<wersja>.
// Zakres:
//  - musi być na allowliście CORS
//  - X-Klovy-Client = KlovyChatApp/<wersja>; CORS allowlista
// Zmiana identyfikatora = middleware client.rs + cors.rs + ten plik.
// Przy zmianach: api/client.ts, utils/security/id.rs.

export const CLIENT_HEADER_NAME = "X-Klovy-Client";

export const CLIENT_USER_AGENT_HEADER = "X-Klovy-User-Agent";

const CLIENT_NAME = "KlovyChatApp";
const CLIENT_VERSION = "1.0";

export const CLIENT_IDENTIFIER = `${CLIENT_NAME}/${CLIENT_VERSION}`;

export const CLIENT_QUERY_PARAM = "client";

export const CLIENT_QUERY_VALUE = CLIENT_NAME;
