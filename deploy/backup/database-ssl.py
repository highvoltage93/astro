import os
from urllib.parse import urlsplit, parse_qs

# Validate the connection as structured data, never by matching credentials in a URL string.
try:
    url = urlsplit(os.environ["BACKUP_DATABASE_URL"])
    query = parse_qs(url.query, keep_blank_values=True)
    allowed = {"sslmode", "channel_binding", "connect_timeout", "application_name"}
    if url.scheme not in ("postgres", "postgresql") or not url.hostname or set(query) - allowed:
        raise ValueError()
    ssl = query.get("sslmode", ["require"])
    if len(ssl) != 1:
        raise ValueError()
    private = (os.environ.get("ALLOW_PRIVATE_DATABASE") == "true" and
               url.hostname == "postgres" and url.port in (None, 5432) and ssl == ["disable"])
    if not private and ssl[0] not in ("require", "verify-full"):
        raise ValueError()
except (ValueError, KeyError):
    raise SystemExit("Invalid backup connection: require TLS, or explicit private postgres Docker mode")
print("disable" if private else ssl[0])
