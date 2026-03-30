---
"@savvy-web/silk-effects": patch
---
## Bug Fixes

### Fix ManagedSection markers missing newline separators from content

BEGIN/END markers were concatenated directly with managed content, producing malformed output where markers and content appeared on the same line. The service now ensures markers are always on their own lines and handles boundary newlines transparently on read/write round-trips.
