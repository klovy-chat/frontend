/**
 * Identyfikator oficjalnego klienta dołączany do każdego żądania.
 *
 * Backend odrzuca ruch do API bez tego nagłówka (oraz handshake WS bez
 * parametru `client`), co pozwala tanio odfiltrować niespersonalizowany ruch
 * botów/floodów DoS/DDoS zanim dotrze do logiki aplikacji.
 *
 * To warstwa filtrująca, nie uwierzytelnianie — wartość jest jawna.
 */
/** Nagłówki HTTP — zsynchronizowane z backendem (`utils/security/cors.rs`). */
export const CLIENT_HEADER_NAME = "X-Klovy-Client";

/** Jawny user-agent z przeglądarki (+ opcjonalnie browser/os po separatorze RS). */
export const CLIENT_USER_AGENT_HEADER = "X-Klovy-User-Agent";

const CLIENT_NAME = "KlovyChatApp";
const CLIENT_VERSION = "1.0";

/** Wartość nagłówka HTTP, np. `KlovyChatApp/1.0`. */
export const CLIENT_IDENTIFIER = `${CLIENT_NAME}/${CLIENT_VERSION}`;

/** Parametr zapytania używany przy handshake WebSocket. */
export const CLIENT_QUERY_PARAM = "client";

/** Wartość parametru WS (bez wersji, by uniknąć kodowania znaku `/`). */
export const CLIENT_QUERY_VALUE = CLIENT_NAME;
