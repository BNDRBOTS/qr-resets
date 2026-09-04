#!/usr/bin/env python3
"""
Resilient organization/resource verifier.

Goals
-----
* Ingest heterogeneous JSON (arrays, objects, wrapped lists, JSONL/NDJSON,
  concatenated JSON) plus CSV/TSV without assuming one schema.
* Preserve provenance and never silently discard a record because one field,
  endpoint, parser, or verification method fails.
* Separate syntax/plausibility from live corroboration.
* Never label a site dead from one timeout, one HTTP error, a blocked HEAD,
  a TLS problem, or a dead deep-link when the root domain still answers.
* Verify URLs, organization-name alignment, phones, emails, and discovered
  contact pages with multiple fallbacks and an evidence trail.
* Deduplicate only with strong identity evidence; ambiguous similarities are
  flagged instead of auto-merged.
* Continue through per-record failures and write checkpoint/evidence output.
* Core operation uses the Python standard library; optional audited dependencies add Excel, phone-plan, MX, and CA-bundle coverage.

Typical usage
-------------
  python verify_resources_robust.py master.json -o verified_out
  python verify_resources_robust.py one.json two.json data.jsonl -o verified_out
  python verify_resources_robust.py master.json -o verified_out --no-network
  python verify_resources_robust.py --self-test

Version 4 adds spreadsheet/text ingestion, stronger encoding/header recovery, optional
numbering-plan and mail-DNS checks, UI progress hooks, and audit environment metadata.

The default is live network verification. If the machine has no usable network,
records are reported INCONCLUSIVE/OFFLINE, never falsely DEAD.
"""
from __future__ import annotations

import argparse
import csv
import dataclasses
import datetime as dt
import difflib
import hashlib
import importlib.util
import importlib.metadata
import platform
import html
import json
import os
import random
import queue
import re
import socket
import sqlite3
import ssl
import sys
import threading
import time
import traceback
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field, asdict
from html.parser import HTMLParser
from pathlib import Path
from typing import Any, Iterable, Iterator, Optional

VERSION = "4.0.0"
DEFAULT_TIMEOUT = 9.0
DEFAULT_RETRIES = 2
DEFAULT_WORKERS = 8
MAX_BODY_BYTES = 1_250_000
CACHE_TTL_HOURS = 72

SUPPORTED_EXTENSIONS = {
    ".json", ".jsonl", ".ndjson", ".csv", ".tsv", ".tab", ".txt", ".md", ".text",
    ".xlsx", ".xlsm",
}
OPTIONAL_DEPENDENCIES = {
    "openpyxl": "Excel (.xlsx/.xlsm) ingestion",
    "phonenumbers": "numbering-plan plausibility checks",
    "dns": "MX-aware email-domain checks (dnspython)",
    "certifi": "current CA certificate bundle when available",
}
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0 Safari/537.36 ResourceVerifier/4.0"
)

PLACEHOLDERS = {
    "", "n/a", "na", "none", "null", "unknown", "not available", "tbd",
    "[must_get]", "[must get]", "[not present in source]", "not present in source",
}

FIELD_ALIASES = {
    "name": [
        "Resource_Name", "Resource", "resource_name", "org_name", "organization",
        "organization_name", "org_name_verbatim", "name", "title",
    ],
    "category": ["Category", "category", "type", "resource_type"],
    "phone": ["Phone", "phone", "telephone", "tel", "phone_number"],
    "email": ["Email", "email", "e-mail", "contact_email"],
    "url": [
        "URL/Location", "URL", "url", "website", "Website", "web", "link",
        "location_url", "homepage",
    ],
    "description": [
        "Description_Context", "description", "Description", "context", "notes",
        "Existing_Notes/Tips_Verbatim", "details", "summary",
    ],
    "source": ["Source_Document", "source", "Source", "source_document", "provenance"],
}
IDENTITY_KEYS = {x.lower() for vals in FIELD_ALIASES.values() for x in vals}

URL_RE = re.compile(r"(?i)\b(?:https?://|www\.)[^\s<>\]\[\)\(\"']+")
BARE_DOMAIN_RE = re.compile(
    r"(?i)(?<![@\w])(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:com|org|net|gov|edu|us|io|co|ai|info|biz)(?:/[^\s<>\]\[\)\(\"']*)?"
)
EMAIL_RE = re.compile(r"(?i)\b[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,63}\b")
PHONE_RE = re.compile(
    r"(?ix)(?:\+?1[\s.\-\(]*)?(?:\(?\d{3}\)?[\s.\-]*)\d{3}[\s.\-]*\d{4}(?:\s*(?:x|ext\.?|extension)\s*\d{1,6})?"
)
VANITY_PHONE_RE = re.compile(
    r"(?ix)(?:\+?1[\s.\-]*)?(?:800|833|844|855|866|877|888)[\s.\-]*[A-Z0-9]{3}[\s.\-]*[A-Z0-9]{4}"
)

# Viability signals are descriptive only; they never override live-contact evidence.
POSITIVE_SIGNALS = {
    "direct cash": 12,
    "mutual aid": 10,
    "peer-to-peer": 10,
    "no lease": 10,
    "no address": 8,
    "walk-in": 5,
    "same-day": 7,
    "emergency": 4,
    "stabilization": 5,
    "transportation": 3,
    "outreach": 4,
    "mobile": 3,
    "rapid rehousing": 4,
    "rapid re-housing": 4,
}
NEGATIVE_SIGNALS = {
    "landlord signature": -12,
    "formal lease required": -12,
    "must have a lease": -12,
    "eviction notice required": -10,
    "court eviction required": -10,
    "referral required": -5,
    "waitlist": -4,
    "waiting list": -4,
    "closed to applications": -18,
    "program ended": -18,
    "no longer accepting": -18,
}

GENERIC_NAME_WORDS = {
    "the", "a", "an", "and", "of", "for", "to", "in", "on", "at", "by",
    "program", "services", "service", "resource", "resources", "grant", "grants",
    "support", "assistance", "fund", "foundation", "center", "centre", "network",
}

_tls = threading.local()
_search_lock = threading.Lock()
_last_search_time = 0.0


def utc_now() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")


def text_value(v: Any) -> str:
    if v is None:
        return ""
    if isinstance(v, str):
        return v.strip()
    if isinstance(v, (int, float, bool)):
        return str(v)
    try:
        return json.dumps(v, ensure_ascii=False, sort_keys=True)
    except Exception:
        return str(v)


def is_placeholder(v: Any) -> bool:
    s = text_value(v).strip().lower()
    if s in PLACEHOLDERS:
        return True
    return bool(re.fullmatch(r"\[(?:must[_ ]?get|not present in source)\]", s, re.I))


def normalize_space(s: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(s or "")).strip()


def canonical_text(s: str) -> str:
    s = html.unescape(s or "").lower()
    s = re.sub(r"https?://(?:www\.)?", " ", s)
    s = re.sub(r"[^a-z0-9]+", " ", s)
    return normalize_space(s)


def name_tokens(s: str) -> set[str]:
    return {t for t in canonical_text(s).split() if len(t) > 1 and t not in GENERIC_NAME_WORDS}


def name_similarity(a: str, b: str) -> float:
    ca, cb = canonical_text(a), canonical_text(b)
    if not ca or not cb:
        return 0.0
    ta, tb = name_tokens(a), name_tokens(b)
    token_score = len(ta & tb) / max(1, len(ta | tb)) if (ta or tb) else 0.0
    seq = difflib.SequenceMatcher(None, ca, cb).ratio()
    containment = 1.0 if (ca in cb or cb in ca) and min(len(ca), len(cb)) >= 6 else 0.0
    return min(1.0, max(seq * 0.72 + token_score * 0.28, token_score, containment * 0.9))


def first_field(record: dict[str, Any], aliases: Iterable[str]) -> str:
    for key in aliases:
        if key in record and not is_placeholder(record[key]):
            return text_value(record[key])
    # Case-insensitive fallback.
    lower = {str(k).lower(): k for k in record}
    for key in aliases:
        real = lower.get(key.lower())
        if real is not None and not is_placeholder(record[real]):
            return text_value(record[real])
    return ""


def looks_record_like(obj: dict[str, Any]) -> bool:
    keys = {str(k).lower() for k in obj.keys()}
    hits = len(keys & IDENTITY_KEYS)
    return hits >= 2 or (hits >= 1 and len(obj) >= 3)


@dataclass
class ParseIssue:
    source_file: str
    stage: str
    message: str
    line: Optional[int] = None
    fatal: bool = False


@dataclass
class RawRecord:
    data: dict[str, Any]
    source_file: str
    source_index: int
    parser: str
    recovered: bool = False


@dataclass
class NormalizedRecord:
    record_id: str
    name: str
    category: str
    phones: list[str]
    emails: list[str]
    urls: list[str]
    description: str
    source_document: str
    source_files: list[str]
    source_indexes: list[int]
    raw_records: list[dict[str, Any]] = field(default_factory=list)
    flags: list[str] = field(default_factory=list)


@dataclass
class HTTPAttempt:
    requested_url: str
    method: str
    outcome: str
    status: Optional[int] = None
    final_url: str = ""
    error_type: str = ""
    error: str = ""
    elapsed_ms: int = 0
    content_type: str = ""
    bytes_read: int = 0


@dataclass
class PageEvidence:
    requested_url: str
    canonical_url: str
    website_status: str
    status_reason: str
    dns_status: str
    dns_addresses: list[str]
    attempts: list[HTTPAttempt]
    title: str = ""
    site_name: str = ""
    text_excerpt: str = ""
    discovered_urls: list[str] = field(default_factory=list)
    discovered_emails: list[str] = field(default_factory=list)
    discovered_phones: list[str] = field(default_factory=list)
    discovered_addresses: list[str] = field(default_factory=list)
    discovered_contact_names: list[str] = field(default_factory=list)
    contact_pages_checked: list[str] = field(default_factory=list)
    discovery_method: str = "SOURCE"
    name_similarity: float = 0.0
    soft_404: bool = False


@dataclass
class VerificationRecord:
    record_id: str
    name: str
    suggested_name: str
    category: str
    organization_status: str
    organization_reason: str
    urls: list[dict[str, Any]]
    phones: list[dict[str, Any]]
    emails: list[dict[str, Any]]
    addresses: list[dict[str, Any]]
    contact_names: list[dict[str, Any]]
    viability: dict[str, Any]
    duplicate_group_id: str
    duplicate_confidence: str
    flags: list[str]
    source_files: list[str]
    source_indexes: list[int]
    source_document: str
    description: str
    discovery_notes: list[str]
    errors: list[str]


class ResourceHTMLParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.title_parts: list[str] = []
        self.text_parts: list[str] = []
        self.links: list[tuple[str, str]] = []
        self.meta: dict[str, str] = {}
        self._in_title = False
        self._current_link: Optional[str] = None
        self._current_anchor: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, Optional[str]]]):
        d = {k.lower(): (v or "") for k, v in attrs}
        if tag.lower() == "title":
            self._in_title = True
        elif tag.lower() == "a":
            self._current_link = d.get("href", "")
            self._current_anchor = []
        elif tag.lower() == "meta":
            key = (d.get("property") or d.get("name") or "").lower()
            val = d.get("content", "")
            if key and val:
                self.meta[key] = val

    def handle_endtag(self, tag: str):
        if tag.lower() == "title":
            self._in_title = False
        elif tag.lower() == "a" and self._current_link is not None:
            self.links.append((self._current_link, normalize_space(" ".join(self._current_anchor))))
            self._current_link = None
            self._current_anchor = []

    def handle_data(self, data: str):
        s = normalize_space(data)
        if not s:
            return
        if self._in_title:
            self.title_parts.append(s)
        if self._current_link is not None:
            self._current_anchor.append(s)
        self.text_parts.append(s)

    @property
    def title(self) -> str:
        return normalize_space(" ".join(self.title_parts))

    @property
    def text(self) -> str:
        return normalize_space(" ".join(self.text_parts))


def iter_records_from_obj(obj: Any) -> Iterator[dict[str, Any]]:
    if isinstance(obj, dict):
        if looks_record_like(obj):
            yield obj
            return
        # Wrapper object: recurse through collections, preserving every record-like child.
        for v in obj.values():
            if isinstance(v, (dict, list, tuple)):
                yield from iter_records_from_obj(v)
    elif isinstance(obj, (list, tuple)):
        for item in obj:
            yield from iter_records_from_obj(item)


def parse_json_resilient(path: Path) -> tuple[list[RawRecord], list[ParseIssue]]:
    issues: list[ParseIssue] = []
    raw, encoding, decode_issues = decode_text_resilient(path)
    issues.extend(decode_issues)
    records: list[RawRecord] = []
    duplicate_keys: list[str] = []

    def object_hook(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
        d: dict[str, Any] = {}
        for k, v in pairs:
            if k in d:
                duplicate_keys.append(str(k))
            d[k] = v
        return d

    # 1) Standard JSON. Duplicate keys are surfaced because Python otherwise keeps the
    # last value silently, which can make corrupted source data appear clean.
    try:
        obj = json.loads(raw, object_pairs_hook=object_hook)
        found = list(iter_records_from_obj(obj))
        if duplicate_keys:
            examples = ", ".join(stable_unique(duplicate_keys)[:12])
            issues.append(ParseIssue(str(path), "json_duplicate_keys", f"Duplicate JSON object keys detected (last value retained by JSON semantics): {examples}", fatal=False))
        for i, rec in enumerate(found):
            records.append(RawRecord(rec, str(path), i, "json", encoding not in {"utf-8", "utf-8-sig"}))
        if found:
            return records, issues
        issues.append(ParseIssue(str(path), "json", "Valid JSON contained no record-like objects."))
    except json.JSONDecodeError as e:
        issues.append(ParseIssue(str(path), "json", f"Standard JSON parse failed: {e.msg}", e.lineno, False))

    # 2) JSONL / NDJSON. Bad lines are skipped individually and logged.
    jsonl_records: list[dict[str, Any]] = []
    meaningful_lines = 0
    bad_lines = 0
    for lineno, line in enumerate(raw.splitlines(), 1):
        if not line.strip():
            continue
        meaningful_lines += 1
        line_dups: list[str] = []
        def line_hook(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
            d: dict[str, Any] = {}
            for k, v in pairs:
                if k in d:
                    line_dups.append(str(k))
                d[k] = v
            return d
        try:
            obj = json.loads(line, object_pairs_hook=line_hook)
            jsonl_records.extend(iter_records_from_obj(obj))
            if line_dups:
                issues.append(ParseIssue(str(path), "jsonl_duplicate_keys", f"Duplicate key(s) on line: {', '.join(stable_unique(line_dups)[:12])}", lineno, False))
        except json.JSONDecodeError as e:
            bad_lines += 1
            issues.append(ParseIssue(str(path), "jsonl", f"Line parse failed: {e.msg}", lineno, False))
    if jsonl_records and (bad_lines == 0 or len(jsonl_records) >= max(1, meaningful_lines // 2)):
        for i, rec in enumerate(jsonl_records):
            records.append(RawRecord(rec, str(path), i, "jsonl", bad_lines > 0 or encoding not in {"utf-8", "utf-8-sig"}))
        return records, issues

    # 3) Concatenated/mixed JSON recovery using raw_decode. This never declares the
    # file clean; recovered records carry a flag and parse issues remain visible.
    recovery_dups: list[str] = []
    def recovery_hook(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
        d: dict[str, Any] = {}
        for k, v in pairs:
            if k in d:
                recovery_dups.append(str(k))
            d[k] = v
        return d
    decoder = json.JSONDecoder(object_pairs_hook=recovery_hook)
    pos = 0
    recovered: list[dict[str, Any]] = []
    while pos < len(raw):
        while pos < len(raw) and raw[pos].isspace():
            pos += 1
        if pos >= len(raw):
            break
        try:
            obj, end = decoder.raw_decode(raw, pos)
            recovered.extend(iter_records_from_obj(obj))
            pos = end
        except json.JSONDecodeError:
            nxt = min([x for x in (raw.find("{", pos + 1), raw.find("[", pos + 1)) if x >= 0], default=-1)
            if nxt < 0:
                break
            pos = nxt
    if recovered:
        issues.append(ParseIssue(str(path), "json_recovery", f"Recovered {len(recovered)} record-like objects from malformed/mixed JSON.", fatal=False))
        if recovery_dups:
            issues.append(ParseIssue(str(path), "json_duplicate_keys", f"Duplicate keys also occurred in recovered JSON: {', '.join(stable_unique(recovery_dups)[:12])}", fatal=False))
        for i, rec in enumerate(recovered):
            records.append(RawRecord(rec, str(path), i, "json_recovery", True))
        return records, issues

    issues.append(ParseIssue(str(path), "json", "No usable records could be recovered.", fatal=True))
    return [], issues


def decode_text_resilient(path: Path) -> tuple[str, str, list[ParseIssue]]:
    """Decode human-generated text without silently corrupting it.

    UTF-8 is authoritative. BOM-aware UTF-16 and Windows-1252 are recovery paths and
    are explicitly recorded in parse issues. Latin-1 is the final lossless byte-to-text
    fallback so a file is preserved instead of disappearing.
    """
    raw = path.read_bytes()
    issues: list[ParseIssue] = []
    candidates: list[str] = []
    if raw.startswith(b"\xff\xfe") or raw.startswith(b"\xfe\xff"):
        candidates.append("utf-16")
    candidates.extend(["utf-8-sig", "cp1252", "latin-1"])
    seen: set[str] = set()
    for enc in candidates:
        if enc in seen:
            continue
        seen.add(enc)
        try:
            text = raw.decode(enc, errors="strict")
            if enc not in {"utf-8", "utf-8-sig"}:
                issues.append(ParseIssue(str(path), "decode_recovery", f"Decoded using {enc}; original file was not clean UTF-8.", fatal=False))
            return text, enc, issues
        except UnicodeDecodeError:
            continue
    # This should be unreachable because latin-1 maps every byte, but preserve a guard.
    text = raw.decode("utf-8", errors="replace")
    issues.append(ParseIssue(str(path), "decode_recovery", "Decoded with replacement characters after all strict decoders failed.", fatal=False))
    return text, "utf-8-replace", issues


def _header_key(value: Any) -> str:
    return re.sub(r"[^a-z0-9]+", "", text_value(value).lower())


_ALIAS_HEADER_KEYS = {_header_key(x) for vals in FIELD_ALIASES.values() for x in vals}


def _header_score(row: list[Any]) -> tuple[int, int, int]:
    values = [text_value(x) for x in row]
    nonempty = [x for x in values if x]
    alias_hits = sum(1 for x in nonempty if _header_key(x) in _ALIAS_HEADER_KEYS)
    unique = len({_header_key(x) for x in nonempty if _header_key(x)})
    # Alias hits dominate. Breadth/uniqueness only break ties.
    return alias_hits, min(len(nonempty), 20), min(unique, 20)


def _choose_header_row(rows: list[list[Any]], max_scan: int = 25) -> int:
    if not rows:
        return 0
    limit = min(len(rows), max_scan)
    scored = [(i, _header_score(rows[i])) for i in range(limit)]
    best_i, best = max(scored, key=lambda x: x[1])
    if best[0] >= 2:
        return best_i
    # With no recognizable schema, prefer the first row that looks like a real tabular
    # header (>=2 nonempty unique strings), otherwise fall back to row zero.
    for i in range(limit):
        vals = [text_value(x) for x in rows[i] if text_value(x)]
        if len(vals) >= 2 and len({_header_key(x) for x in vals}) == len(vals):
            return i
    return 0


def _unique_headers(row: list[Any]) -> list[str]:
    headers: list[str] = []
    counts: Counter[str] = Counter()
    for i, cell in enumerate(row):
        base = normalize_space(text_value(cell)) or f"Column_{i+1}"
        counts[base] += 1
        headers.append(base if counts[base] == 1 else f"{base}__{counts[base]}")
    return headers


def _records_from_rows(rows: list[list[Any]], source_file: str, parser: str,
                       issues: list[ParseIssue], recovered: bool = False) -> list[RawRecord]:
    if not rows:
        return []
    header_i = _choose_header_row(rows)
    if header_i > 0:
        issues.append(ParseIssue(source_file, parser, f"Detected header at row {header_i + 1}; preserved preceding title/metadata rows as a recovery note.", line=header_i + 1, fatal=False))
    headers = _unique_headers(rows[header_i])
    out: list[RawRecord] = []
    for row_i, row in enumerate(rows[header_i + 1:], header_i + 2):
        vals = [text_value(x) for x in row]
        if not any(vals):
            continue
        data: dict[str, Any] = {}
        for col_i, value in enumerate(vals):
            if col_i < len(headers):
                data[headers[col_i]] = value
            elif value:
                data.setdefault("__extra_columns__", []).append(value)
        if data and any(text_value(v) for v in data.values()):
            out.append(RawRecord(data, source_file, row_i, parser, recovered))
    return out


def _sniff_dialect(text: str, suffix: str = ""):
    sample = text[:131072]
    try:
        return csv.Sniffer().sniff(sample, delimiters=",\t;|")
    except csv.Error:
        if suffix.lower() in {".tsv", ".tab"}:
            return csv.excel_tab
        # Pick a delimiter by consistency rather than blindly choosing comma.
        lines = [ln for ln in text.splitlines()[:30] if ln.strip()]
        best = ","
        best_score = (-1, -1)
        for delim in ["\t", ",", ";", "|"]:
            counts = [ln.count(delim) for ln in lines]
            positive = [x for x in counts if x > 0]
            if not positive:
                continue
            mode_count = Counter(positive).most_common(1)[0][1]
            score = (mode_count, sum(positive))
            if score > best_score:
                best, best_score = delim, score
        class D(csv.excel):
            delimiter = best
        return D


def parse_delimited(path: Path) -> tuple[list[RawRecord], list[ParseIssue]]:
    text, encoding, issues = decode_text_resilient(path)
    try:
        dialect = _sniff_dialect(text, path.suffix)
        reader = csv.reader(text.splitlines(), dialect=dialect)
        rows = [list(r) for r in reader]
        records = _records_from_rows(rows, str(path), "delimited", issues, recovered=(encoding not in {"utf-8", "utf-8-sig"}))
        if not records:
            issues.append(ParseIssue(str(path), "delimited", "No usable data rows found after header detection.", fatal=True))
        return records, issues
    except Exception as e:
        issues.append(ParseIssue(str(path), "delimited", f"Delimited parse failure: {e.__class__.__name__}: {e}", fatal=True))
        return [], issues


def parse_excel(path: Path) -> tuple[list[RawRecord], list[ParseIssue]]:
    issues: list[ParseIssue] = []
    try:
        import openpyxl  # type: ignore
    except Exception as e:
        return [], [ParseIssue(str(path), "excel", f"Excel support requires openpyxl; bootstrap should install it. Import failed: {e}", fatal=True)]
    records: list[RawRecord] = []
    try:
        wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    except Exception as e:
        return [], [ParseIssue(str(path), "excel", f"Workbook open failed: {e.__class__.__name__}: {e}", fatal=True)]
    try:
        for ws in wb.worksheets:
            try:
                rows = [list(r) for r in ws.iter_rows(values_only=True)]
                nonempty = [r for r in rows if any(text_value(v) for v in r)]
                if not nonempty:
                    continue
                source = f"{path}#sheet={ws.title}"
                sheet_issues: list[ParseIssue] = []
                sheet_records = _records_from_rows(nonempty, source, "excel", sheet_issues, recovered=False)
                issues.extend(sheet_issues)
                records.extend(sheet_records)
            except Exception as e:
                issues.append(ParseIssue(f"{path}#sheet={ws.title}", "excel_sheet", f"Sheet parse failed but other sheets continue: {e.__class__.__name__}: {e}", fatal=False))
    finally:
        try:
            wb.close()
        except Exception:
            pass
    if not records:
        issues.append(ParseIssue(str(path), "excel", "Workbook contained no usable tabular records.", fatal=True))
    return records, issues


def _text_label_map() -> dict[str, str]:
    out: dict[str, str] = {}
    for semantic, aliases in FIELD_ALIASES.items():
        for alias in aliases:
            out[_header_key(alias)] = semantic
    extras = {
        "provides": "description", "benefits": "description", "eligibility": "description",
        "intake": "description", "address": "description", "fulladdress": "description",
        "contact": "description", "contactname": "description", "notes": "description",
    }
    out.update(extras)
    return out


def parse_text_resilient(path: Path) -> tuple[list[RawRecord], list[ParseIssue]]:
    text, encoding, issues = decode_text_resilient(path)
    stripped = text.lstrip()

    # A JSON payload with a .txt/.md extension is common in exported pipelines.
    if stripped.startswith("{") or stripped.startswith("["):
        try:
            obj = json.loads(text)
            found = list(iter_records_from_obj(obj))
            if found:
                return [RawRecord(r, str(path), i, "json_in_text", encoding not in {"utf-8", "utf-8-sig"}) for i, r in enumerate(found)], issues
        except Exception as e:
            issues.append(ParseIssue(str(path), "json_in_text", f"JSON-looking text did not parse cleanly; continuing with text recovery: {e}", fatal=False))

    # Detect genuinely tabular text. Require a stable delimiter pattern to avoid turning
    # narrative prose containing semicolons/pipes into a fake spreadsheet.
    lines = [ln for ln in text.splitlines() if ln.strip()]
    for delim in ["\t", "|", ",", ";"]:
        counts = [ln.count(delim) for ln in lines[:25]]
        positive = [x for x in counts if x >= 2]
        if len(positive) >= 3 and Counter(positive).most_common(1)[0][1] >= 3:
            try:
                reader = csv.reader(text.splitlines(), delimiter=delim)
                rows = [list(r) for r in reader]
                recs = _records_from_rows(rows, str(path), "text_delimited", issues, recovered=True)
                if recs:
                    issues.append(ParseIssue(str(path), "text_delimited", f"Recovered structured rows from text using {repr(delim)} delimiter.", fatal=False))
                    return recs, issues
            except Exception as e:
                issues.append(ParseIssue(str(path), "text_delimited", f"Delimited-text recovery failed non-fatally: {e}", fatal=False))

    label_map = _text_label_map()
    # Split on strong separators or blank-line gaps. This is intentionally conservative.
    blocks = re.split(r"(?:\r?\n){2,}|(?:^|\n)\s*[=*_\-]{6,}\s*(?:\n|$)", text)
    parsed: list[RawRecord] = []
    for block_i, block in enumerate(blocks):
        blines = [normalize_space(x) for x in block.splitlines() if normalize_space(x)]
        if not blines:
            continue
        data: dict[str, Any] = {}
        desc_parts: list[str] = []
        labeled_hits = 0
        first_unlabeled = ""
        for line in blines:
            m = re.match(r"^([A-Za-z][A-Za-z0-9 _/\-&'.]{1,45})\s*:\s*(.*)$", line)
            if not m:
                if not first_unlabeled:
                    first_unlabeled = line
                desc_parts.append(line)
                continue
            label, value = normalize_space(m.group(1)), normalize_space(m.group(2))
            semantic = label_map.get(_header_key(label))
            if semantic:
                labeled_hits += 1
                if semantic == "name" and value:
                    data.setdefault("Resource_Name", value)
                elif semantic == "category" and value:
                    data.setdefault("Category", value)
                elif semantic == "phone" and value:
                    data.setdefault("Phone", value)
                elif semantic == "email" and value:
                    data.setdefault("Email", value)
                elif semantic == "url" and value:
                    data.setdefault("URL/Location", value)
                elif semantic == "source" and value:
                    data.setdefault("Source_Document", value)
                else:
                    desc_parts.append(f"{label}: {value}")
            else:
                desc_parts.append(line)
        if labeled_hits >= 2 or (labeled_hits >= 1 and len(blines) >= 3):
            if "Resource_Name" not in data and first_unlabeled:
                data["Resource_Name"] = first_unlabeled[:240]
            data.setdefault("Description_Context", "\n".join(desc_parts))
            data.setdefault("Source_Document", path.name)
            parsed.append(RawRecord(data, str(path), block_i, "text_blocks", True))

    if parsed:
        issues.append(ParseIssue(str(path), "text_blocks", f"Heuristically recovered {len(parsed)} labeled text block(s); source text is preserved in normalized snapshots.", fatal=False))
        return parsed, issues

    # Final preservation path: never discard an otherwise readable text file.
    first = next((normalize_space(x) for x in text.splitlines() if normalize_space(x)), "[UNNAMED TEXT FILE]")
    issues.append(ParseIssue(str(path), "text_preservation", "No safe multi-record structure was detected; preserved the complete text as one reviewable record rather than guessing boundaries.", fatal=False))
    return [RawRecord({
        "Resource_Name": first[:240],
        "Category": "UNSTRUCTURED_TEXT",
        "Description_Context": text,
        "Source_Document": path.name,
    }, str(path), 0, "text_preservation", True)], issues


def parse_input(path: Path) -> tuple[list[RawRecord], list[ParseIssue]]:
    ext = path.suffix.lower()
    if ext in {".csv", ".tsv", ".tab"}:
        return parse_delimited(path)
    if ext in {".xlsx", ".xlsm"}:
        return parse_excel(path)
    if ext in {".txt", ".md", ".text"}:
        return parse_text_resilient(path)
    # Unknown/no extension: try JSON first, then text preservation as a fallback.
    if ext in {".json", ".jsonl", ".ndjson", ""}:
        recs, issues = parse_json_resilient(path)
        if recs or ext:
            return recs, issues
        text_recs, text_issues = parse_text_resilient(path)
        return text_recs, issues + text_issues
    return [], [ParseIssue(str(path), "input", f"Unsupported file extension: {ext or '[none]'}", fatal=True)]


def split_urls(value: str, allow_bare: bool = True) -> list[str]:
    if not value or is_placeholder(value):
        return []
    found: list[str] = []
    # Prefer explicit http(s)/www references. A bare-domain fallback is appropriate for
    # dedicated URL fields, but is intentionally disabled for narrative text because
    # source prose can contain fused citation artifacts that only look like domains.
    for m in URL_RE.finditer(value):
        found.append(m.group(0).rstrip(".,;:!?)]}>"))
    if allow_bare and not found:
        for m in BARE_DOMAIN_RE.finditer(value):
            found.append(m.group(0).rstrip(".,;:!?)]}>"))
    s = value.strip()
    if allow_bare and not found and re.fullmatch(r"(?i)(?:www\.)?[a-z0-9.-]+\.[a-z]{2,63}(?:/[^\s]*)?", s):
        found.append(s)
    return stable_unique(normalize_url(u) for u in found if normalize_url(u))



def split_labeled_context_urls(value: str) -> list[str]:
    """Extract bare URLs from narrative only when a nearby label makes URL intent clear."""
    if not value:
        return []
    found: list[str] = []
    label_re = re.compile(
        r"(?ix)\b(?:website|web|url|link|source\s+urls?|intake|apply|details)\s*:\s*"
        r"((?:https?://|www\.)?[^\s|,;]+\.[a-z]{2,63}(?:/[^\s|,;]*)?)"
    )
    for m in label_re.finditer(value):
        found.extend(split_urls(m.group(1), allow_bare=True))
    return stable_unique(found)

def normalize_url(url: str) -> str:
    if not url:
        return ""
    u = html.unescape(url.strip().strip("<>\"'"))
    u = u.replace("\\/", "/")
    if u.lower().startswith("www.") or ("://" not in u and BARE_DOMAIN_RE.fullmatch(u)):
        u = "https://" + u
    if not re.match(r"(?i)^https?://", u):
        return ""
    try:
        p = urllib.parse.urlsplit(u)
        host = (p.hostname or "").lower().rstrip(".")
        if not host or "." not in host:
            return ""
        port = p.port
        netloc = host
        if port and not ((p.scheme == "http" and port == 80) or (p.scheme == "https" and port == 443)):
            netloc += f":{port}"
        path = re.sub(r"/{2,}", "/", p.path or "/")
        # Remove common tracking params but preserve functional query parameters.
        q = urllib.parse.parse_qsl(p.query, keep_blank_values=True)
        q = [(k, v) for k, v in q if not re.match(r"(?i)^(utm_|fbclid$|gclid$)", k)]
        query = urllib.parse.urlencode(q, doseq=True)
        return urllib.parse.urlunsplit((p.scheme.lower(), netloc, path, query, ""))
    except Exception:
        return ""


def root_url(url: str) -> str:
    try:
        p = urllib.parse.urlsplit(url)
        return urllib.parse.urlunsplit((p.scheme, p.netloc, "/", "", ""))
    except Exception:
        return url


def url_host(url: str) -> str:
    try:
        return (urllib.parse.urlsplit(url).hostname or "").lower().removeprefix("www.")
    except Exception:
        return ""


def split_emails(value: str) -> list[str]:
    if not value or is_placeholder(value):
        return []
    return stable_unique(m.group(0).lower() for m in EMAIL_RE.finditer(value))


VANITY_MAP = str.maketrans({
    **dict.fromkeys("ABC", "2"), **dict.fromkeys("DEF", "3"),
    **dict.fromkeys("GHI", "4"), **dict.fromkeys("JKL", "5"),
    **dict.fromkeys("MNO", "6"), **dict.fromkeys("PQRS", "7"),
    **dict.fromkeys("TUV", "8"), **dict.fromkeys("WXYZ", "9"),
})


def normalize_phone(phone: str) -> str:
    if not phone or is_placeholder(phone):
        return ""
    s = phone.upper().translate(VANITY_MAP)
    ext = ""
    em = re.search(r"(?i)(?:x|ext\.?|extension)\s*(\d{1,6})\s*$", s)
    if em:
        ext = em.group(1)
        s = s[: em.start()]
    digits = re.sub(r"\D", "", s)
    if len(digits) == 11 and digits.startswith("1"):
        digits = digits[1:]
    if len(digits) != 10:
        return ""
    # NANP basic sanity: area/exchange cannot start with 0/1.
    if digits[0] in "01" or digits[3] in "01":
        return ""
    out = f"+1-{digits[:3]}-{digits[3:6]}-{digits[6:]}"
    return out + (f" x{ext}" if ext else "")


def split_phones(value: str) -> list[str]:
    if not value or is_placeholder(value):
        return []
    # Mask URLs/emails first so long numeric URL path IDs (Facebook groups, case IDs,
    # tracking IDs) cannot masquerade as telephone numbers.
    scrubbed = URL_RE.sub(" ", value)
    scrubbed = BARE_DOMAIN_RE.sub(" ", scrubbed)
    scrubbed = EMAIL_RE.sub(" ", scrubbed)
    candidates = [m.group(0) for m in PHONE_RE.finditer(scrubbed)]
    candidates += [m.group(0) for m in VANITY_PHONE_RE.finditer(scrubbed)]
    out = [normalize_phone(x) for x in candidates]
    return stable_unique(x for x in out if x)


def stable_unique(values: Iterable[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for v in values:
        if v and v not in seen:
            seen.add(v)
            out.append(v)
    return out


def record_hash(name: str, category: str, source_file: str, source_index: int, raw: dict[str, Any]) -> str:
    payload = json.dumps(raw, ensure_ascii=False, sort_keys=True, default=str)
    return hashlib.sha256(f"{name}\n{category}\n{source_file}\n{source_index}\n{payload}".encode()).hexdigest()[:20]


def normalize_raw(rr: RawRecord) -> NormalizedRecord:
    r = rr.data
    name = first_field(r, FIELD_ALIASES["name"])
    category = first_field(r, FIELD_ALIASES["category"])
    phone_field = first_field(r, FIELD_ALIASES["phone"])
    email_field = first_field(r, FIELD_ALIASES["email"])
    url_field = first_field(r, FIELD_ALIASES["url"])
    description = first_field(r, FIELD_ALIASES["description"])
    source = first_field(r, FIELD_ALIASES["source"])

    # Extract communication endpoints from explicit fields first, then context as fallback.
    phones = split_phones(phone_field)
    emails = split_emails(email_field)
    urls = split_urls(url_field)
    if description:
        phones = stable_unique(phones + split_phones(description))
        emails = stable_unique(emails + split_emails(description))
        urls = stable_unique(urls + split_urls(description, allow_bare=False) + split_labeled_context_urls(description))

    flags: list[str] = []
    # Historical extraction pipelines sometimes interpreted numeric social-media/path IDs
    # as US phone numbers. If all 10 phone digits occur contiguously inside a URL's digits,
    # quarantine that value instead of presenting it as a contact number.
    url_digit_streams = [re.sub(r"\D", "", u) for u in urls]
    filtered_phones = []
    for ph in phones:
        d = phone_digits(ph)
        if d and any(d in uds for uds in url_digit_streams):
            flags.append("phone_matches_url_numeric_id_quarantined")
            continue
        filtered_phones.append(ph)
    phones = stable_unique(filtered_phones)
    if not name:
        name = "[UNNAMED RECORD]"
        flags.append("missing_name")
    if len(name) > 140 or "\n" in name or "\t" in name:
        flags.append("name_looks_compound_or_malformed")
    if re.match(r"(?i)^https?://", name) or BARE_DOMAIN_RE.fullmatch(name.strip()):
        flags.append("name_is_url_like")
    if any("must_get" in canonical_text(text_value(v)).replace(" ", "_") for v in r.values()):
        flags.append("contains_must_get_placeholders")
    if rr.recovered:
        flags.append("recovered_from_malformed_input")
    if len({url_host(u) for u in urls if url_host(u)}) > 1:
        flags.append("multiple_domains_compound_record")
    if phone_field and not is_placeholder(phone_field) and not phones and "phone_matches_url_numeric_id_quarantined" not in flags:
        flags.append("source_phone_unparseable")
    if email_field and not is_placeholder(email_field) and not emails:
        flags.append("source_email_unparseable")
    if url_field and not is_placeholder(url_field) and not urls:
        flags.append("source_url_unparseable")
    if url_field and not is_placeholder(url_field) and re.search(r"\S/[^|;]*\s+[^|;]*", url_field):
        flags.append("source_url_contains_unescaped_whitespace")

    rid = record_hash(name, category, rr.source_file, rr.source_index, r)
    return NormalizedRecord(
        record_id=rid,
        name=normalize_space(name),
        category=normalize_space(category) or "UNSPECIFIED",
        phones=phones,
        emails=emails,
        urls=urls,
        description=description,
        source_document=source,
        source_files=[rr.source_file],
        source_indexes=[rr.source_index],
        raw_records=[r],
        flags=stable_unique(flags),
    )


def dedupe_records(records: list[NormalizedRecord]) -> tuple[list[NormalizedRecord], dict[str, dict[str, str]], list[dict[str, Any]]]:
    """Very conservative identity dedupe.

    Shared hostnames are weak evidence because one agency/domain can host many different
    programs and one social platform can host thousands of groups. Auto-merge requires
    a strong endpoint/contact match plus name alignment, or an exact specific name with
    no contradictory identifiers. Compound multi-domain rows are never absorbed into
    single-organization rows automatically.
    """
    parent = list(range(len(records)))
    rank = [0] * len(records)

    def find(x: int) -> int:
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(a: int, b: int):
        ra, rb = find(a), find(b)
        if ra == rb:
            return
        if rank[ra] < rank[rb]:
            ra, rb = rb, ra
        parent[rb] = ra
        if rank[ra] == rank[rb]:
            rank[ra] += 1

    def norm_url_identity(u: str) -> str:
        p = urllib.parse.urlsplit(u)
        path = (p.path or "/").rstrip("/") or "/"
        return f"{url_host(u)}{path}".lower()

    def specific_name(r: NormalizedRecord) -> bool:
        c = canonical_text(r.name)
        toks = name_tokens(r.name)
        if not c or c in {"intake", "contact", "resources", "resource", "help", "details"}:
            return False
        return len(toks) >= 2 or len(c) >= 12

    by_url: dict[str, list[int]] = defaultdict(list)
    by_host: dict[str, list[int]] = defaultdict(list)
    by_phone: dict[str, list[int]] = defaultdict(list)
    by_email: dict[str, list[int]] = defaultdict(list)
    by_name: dict[str, list[int]] = defaultdict(list)
    for i, r in enumerate(records):
        for u in r.urls:
            by_url[norm_url_identity(u)].append(i)
            h = url_host(u)
            if h:
                by_host[h].append(i)
        for p in r.phones:
            by_phone[p.split(" x")[0]].append(i)
        for e in r.emails:
            by_email[e].append(i)
        by_name[canonical_text(r.name)].append(i)

    pair_evidence: dict[tuple[int, int], set[str]] = defaultdict(set)
    for kind, index in (("exact_url", by_url), ("phone", by_phone), ("email", by_email), ("host", by_host), ("exact_name", by_name)):
        for key, ids in index.items():
            if not key or len(ids) < 2:
                continue
            # Avoid quadratic explosions on generic shared hosts; host evidence is only
            # worth comparing in modest groups and is never sufficient on its own.
            if kind == "host" and len(ids) > 30:
                continue
            for x in range(len(ids)):
                for y in range(x + 1, len(ids)):
                    a, b = sorted((ids[x], ids[y]))
                    pair_evidence[(a, b)].add(kind)

    ambiguous: list[dict[str, Any]] = []
    for (a, b), kinds in pair_evidence.items():
        ra, rb = records[a], records[b]
        sim = name_similarity(ra.name, rb.name)
        compound = "multiple_domains_compound_record" in ra.flags or "multiple_domains_compound_record" in rb.flags
        urls_a, urls_b = {norm_url_identity(u) for u in ra.urls}, {norm_url_identity(u) for u in rb.urls}
        hosts_a, hosts_b = {url_host(u) for u in ra.urls if url_host(u)}, {url_host(u) for u in rb.urls if url_host(u)}
        phones_a = {p.split(" x")[0] for p in ra.phones}; phones_b = {p.split(" x")[0] for p in rb.phones}
        emails_a, emails_b = set(ra.emails), set(rb.emails)
        exact_name = canonical_text(ra.name) == canonical_text(rb.name) and specific_name(ra) and specific_name(rb)
        exact_url = bool(urls_a & urls_b)
        shared_phone = bool(phones_a & phones_b)
        shared_email = bool(emails_a & emails_b)
        shared_host = bool(hosts_a & hosts_b)

        contradictory = False
        if hosts_a and hosts_b and hosts_a.isdisjoint(hosts_b) and not (shared_phone or shared_email):
            contradictory = True
        if phones_a and phones_b and phones_a.isdisjoint(phones_b) and emails_a and emails_b and emails_a.isdisjoint(emails_b):
            contradictory = True

        merge = False
        reason = ""
        if not compound:
            if exact_url and sim >= 0.62:
                merge, reason = True, "same normalized URL + aligned name"
            elif shared_email and sim >= 0.62:
                merge, reason = True, "same email + aligned name"
            elif shared_phone and sim >= 0.68:
                merge, reason = True, "same phone + strongly aligned name"
            elif exact_name and not contradictory and (shared_host or shared_phone or shared_email or (not hosts_a and not hosts_b and not phones_a and not phones_b and not emails_a and not emails_b)):
                merge, reason = True, "same specific name without conflicting identity evidence"
            elif shared_host and sim >= 0.92 and (canonical_text(ra.name) in canonical_text(rb.name) or canonical_text(rb.name) in canonical_text(ra.name)):
                merge, reason = True, "same host + near-identical contained name"

        if merge:
            union(a, b)
        elif sim >= 0.80 or exact_url or shared_phone or shared_email or exact_name:
            ambiguous.append({
                "record_a": ra.record_id, "record_b": rb.record_id,
                "name_a": ra.name, "name_b": rb.name,
                "name_similarity": round(sim, 3), "shared_evidence": sorted(kinds),
                "reason": "Possible duplicate held separate: auto-merge threshold not met or compound/conflicting evidence present.",
            })

    groups: dict[int, list[int]] = defaultdict(list)
    for i in range(len(records)):
        groups[find(i)].append(i)

    merged: list[NormalizedRecord] = []
    group_meta: dict[str, dict[str, str]] = {}
    for ids in groups.values():
        base = records[ids[0]]
        if len(ids) == 1:
            gid = "dg_" + hashlib.sha1(base.record_id.encode()).hexdigest()[:12]
            group_meta[base.record_id] = {"group_id": gid, "confidence": "UNIQUE_OR_UNMERGED"}
            merged.append(base)
            continue
        members = [records[i] for i in ids]

        def name_quality(m: NormalizedRecord) -> tuple[int, int, int, int]:
            c = canonical_text(m.name)
            narrative_markers = (
                " provides ", " supports ", " pays ", " offers ", " formula funds ",
                " rental assistance ", " website ", " intake ", " eligibility ",
                " description ", " up to ", " direct legal services ", " research ",
                " policy advocacy ", " local referrals ", " grants up to ",
            )
            bad = 0
            bad += 3 if "name_is_url_like" in m.flags else 0
            bad += 2 if "name_looks_compound_or_malformed" in m.flags else 0
            bad += 2 if m.name.lower().startswith("intake") else 0
            bad += sum(1 for marker in narrative_markers if marker.strip() in c)
            bad += 1 if " — " in m.name or "; Intake" in m.name else 0
            bad += 1 if len(m.name) > 100 else 0
            toks = len(name_tokens(m.name))
            incomplete = int(bool(re.search(r"(?:/|\b(?:and|of|for|the))\s*$", m.name, re.I)))
            specificity = min(10, toks)
            # Once narrative/malformed penalties are equal, prefer the fuller specific label
            # rather than a truncated prefix, while capping the benefit of long strings.
            useful_length = min(len(m.name), 90)
            return (-bad, -incomplete, specificity, useful_length)

        canonical_member = max(members, key=name_quality)
        name = canonical_member.name
        merged_id = "m_" + hashlib.sha256("|".join(sorted(m.record_id for m in members)).encode()).hexdigest()[:18]
        m = NormalizedRecord(
            record_id=merged_id, name=name,
            category=canonical_member.category if canonical_member.category != "UNSPECIFIED" else next((x.category for x in members if x.category != "UNSPECIFIED"), "UNSPECIFIED"),
            phones=stable_unique(p for x in members for p in x.phones),
            emails=stable_unique(e for x in members for e in x.emails),
            urls=stable_unique(u for x in members for u in x.urls),
            description=max((x.description for x in members), key=len, default=""),
            source_document="; ".join(stable_unique(x.source_document for x in members if x.source_document)),
            source_files=stable_unique(f for x in members for f in x.source_files),
            source_indexes=[i for x in members for i in x.source_indexes],
            raw_records=[rr for x in members for rr in x.raw_records],
            flags=stable_unique(["deduplicated_strong_identity"] + [f for x in members for f in x.flags]),
        )
        gid = "dg_" + hashlib.sha1(merged_id.encode()).hexdigest()[:12]
        group_meta[m.record_id] = {"group_id": gid, "confidence": "STRONG_IDENTITY_MERGE"}
        merged.append(m)
    return merged, group_meta, ambiguous


class VerificationCache:
    def __init__(self, path: Path, ttl_hours: int = CACHE_TTL_HOURS):
        self.path = path
        self.ttl_hours = ttl_hours
        self.lock = threading.Lock()
        self.conn = sqlite3.connect(path, check_same_thread=False)
        self.conn.execute("""
            CREATE TABLE IF NOT EXISTS http_cache (
                cache_key TEXT PRIMARY KEY,
                created_at REAL NOT NULL,
                payload TEXT NOT NULL
            )
        """)
        self.conn.commit()

    def get(self, key: str) -> Optional[dict[str, Any]]:
        cutoff = time.time() - self.ttl_hours * 3600
        with self.lock:
            row = self.conn.execute("SELECT created_at, payload FROM http_cache WHERE cache_key=?", (key,)).fetchone()
        if not row or row[0] < cutoff:
            return None
        try:
            return json.loads(row[1])
        except Exception:
            return None

    def put(self, key: str, payload: dict[str, Any]):
        with self.lock:
            self.conn.execute(
                "INSERT OR REPLACE INTO http_cache(cache_key,created_at,payload) VALUES(?,?,?)",
                (key, time.time(), json.dumps(payload, ensure_ascii=False)),
            )
            self.conn.commit()

    def close(self):
        with self.lock:
            self.conn.close()


def _dns_resolve_raw(host: str) -> tuple[str, list[str], str]:
    try:
        infos = socket.getaddrinfo(host, 443, type=socket.SOCK_STREAM)
        addrs = stable_unique(x[4][0] for x in infos if x and x[4])
        return ("RESOLVES" if addrs else "NO_ADDRESS", addrs, "")
    except socket.gaierror as e:
        # EAI_AGAIN is a temporary resolver failure and cannot support a dead-domain claim.
        if getattr(e, "errno", None) == getattr(socket, "EAI_AGAIN", object()):
            return "DNS_TEMPORARY_FAILURE", [], f"{e.__class__.__name__}: {e}"
        # EAI_NONAME/NODATA are substantially stronger evidence that the hostname does not exist.
        if getattr(e, "errno", None) in {getattr(socket, "EAI_NONAME", None), getattr(socket, "EAI_NODATA", None)}:
            return "DNS_FAILURE", [], f"{e.__class__.__name__}: {e}"
        return "DNS_ERROR", [], f"{e.__class__.__name__}: {e}"
    except Exception as e:
        return "DNS_ERROR", [], f"{e.__class__.__name__}: {e}"


def dns_resolve(host: str, timeout: float) -> tuple[str, list[str], str]:
    q: queue.Queue = queue.Queue(maxsize=1)
    def run():
        try:
            q.put(_dns_resolve_raw(host), block=False)
        except Exception as e:
            try: q.put(("DNS_ERROR", [], f"{e.__class__.__name__}: {e}"), block=False)
            except Exception: pass
    t = threading.Thread(target=run, daemon=True, name=f"dns:{host[:40]}")
    t.start()
    t.join(max(0.5, timeout))
    if t.is_alive():
        return "DNS_HARD_TIMEOUT", [], f"DNS lookup exceeded hard wall-clock limit of {timeout:.1f}s"
    try:
        return q.get_nowait()
    except queue.Empty:
        return "DNS_ERROR", [], "DNS worker exited without a result"


def make_opener() -> urllib.request.OpenerDirector:
    # Certificate validation always remains enabled. If certifi is installed, prefer its
    # maintained CA bundle; otherwise use the operating system trust store.
    try:
        import certifi  # type: ignore
        ctx = ssl.create_default_context(cafile=certifi.where())
    except Exception:
        ctx = ssl.create_default_context()
    return urllib.request.build_opener(urllib.request.HTTPSHandler(context=ctx))


def read_limited(response, limit: int = MAX_BODY_BYTES) -> bytes:
    chunks = []
    total = 0
    while total < limit:
        chunk = response.read(min(65536, limit - total))
        if not chunk:
            break
        chunks.append(chunk)
        total += len(chunk)
    return b"".join(chunks)


def charset_from_headers(headers) -> str:
    try:
        cs = headers.get_content_charset()
        if cs:
            return cs
    except Exception:
        pass
    return "utf-8"


def _http_attempt_raw(url: str, method: str, timeout: float, read_body: bool = False) -> tuple[HTTPAttempt, bytes, dict[str, str]]:
    start = time.monotonic()
    req = urllib.request.Request(
        url,
        method=method,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/json;q=0.8,*/*;q=0.5",
            "Accept-Language": "en-US,en;q=0.8",
            "Connection": "close",
        },
    )
    body = b""
    hdrs: dict[str, str] = {}
    try:
        opener = getattr(_tls, "opener", None)
        if opener is None:
            opener = make_opener()
            _tls.opener = opener
        with opener.open(req, timeout=timeout) as resp:
            status = int(getattr(resp, "status", resp.getcode()))
            final = resp.geturl()
            ctype = resp.headers.get("Content-Type", "")
            hdrs = {k.lower(): v for k, v in resp.headers.items()}
            if read_body or method == "GET":
                body = read_limited(resp)
            return HTTPAttempt(
                requested_url=url, method=method, outcome="HTTP_RESPONSE", status=status,
                final_url=final, elapsed_ms=int((time.monotonic() - start) * 1000),
                content_type=ctype, bytes_read=len(body),
            ), body, hdrs
    except urllib.error.HTTPError as e:
        # HTTP errors still prove the server answered. Read body for diagnostic/contact evidence.
        try:
            if read_body or method == "GET":
                body = e.read(MAX_BODY_BYTES)
        except Exception:
            body = b""
        hdrs = {k.lower(): v for k, v in getattr(e, "headers", {}).items()} if getattr(e, "headers", None) else {}
        return HTTPAttempt(
            requested_url=url, method=method, outcome="HTTP_RESPONSE", status=int(e.code),
            final_url=getattr(e, "url", url) or url, error_type="HTTPError", error=str(e.reason),
            elapsed_ms=int((time.monotonic() - start) * 1000),
            content_type=hdrs.get("content-type", ""), bytes_read=len(body),
        ), body, hdrs
    except urllib.error.URLError as e:
        reason = getattr(e, "reason", e)
        etype = reason.__class__.__name__
        return HTTPAttempt(
            requested_url=url, method=method, outcome="TRANSPORT_ERROR", error_type=etype,
            error=str(reason), elapsed_ms=int((time.monotonic() - start) * 1000),
        ), b"", {}
    except socket.timeout as e:
        return HTTPAttempt(
            requested_url=url, method=method, outcome="TRANSPORT_ERROR", error_type="Timeout",
            error=str(e), elapsed_ms=int((time.monotonic() - start) * 1000),
        ), b"", {}
    except Exception as e:
        return HTTPAttempt(
            requested_url=url, method=method, outcome="ERROR", error_type=e.__class__.__name__,
            error=str(e), elapsed_ms=int((time.monotonic() - start) * 1000),
        ), b"", {}



def http_attempt(url: str, method: str, timeout: float, read_body: bool = False) -> tuple[HTTPAttempt, bytes, dict[str, str]]:
    """Run one HTTP operation with a hard wall-clock deadline.

    urllib/socket timeouts do not always bound DNS resolver latency on every OS. This
    daemon-thread guard ensures the pipeline continues even when the platform resolver
    or TLS stack ignores the requested socket timeout.
    """
    q: queue.Queue = queue.Queue(maxsize=1)
    start = time.monotonic()
    def run():
        try:
            q.put(_http_attempt_raw(url, method, timeout, read_body), block=False)
        except Exception as e:
            at = HTTPAttempt(
                requested_url=url, method=method, outcome="ERROR",
                error_type=e.__class__.__name__, error=str(e),
                elapsed_ms=int((time.monotonic() - start) * 1000),
            )
            try: q.put((at, b"", {}), block=False)
            except Exception: pass
    t = threading.Thread(target=run, daemon=True, name=f"http:{method}:{url_host(url)[:35]}")
    t.start()
    hard_limit = max(1.5, timeout + 1.25)
    t.join(hard_limit)
    if t.is_alive():
        at = HTTPAttempt(
            requested_url=url, method=method, outcome="TRANSPORT_ERROR",
            error_type="HardTimeout", error=f"Operation exceeded hard wall-clock limit of {hard_limit:.2f}s",
            elapsed_ms=int((time.monotonic() - start) * 1000),
        )
        return at, b"", {}
    try:
        return q.get_nowait()
    except queue.Empty:
        at = HTTPAttempt(
            requested_url=url, method=method, outcome="ERROR", error_type="WorkerNoResult",
            error="HTTP worker exited without a result", elapsed_ms=int((time.monotonic() - start) * 1000),
        )
        return at, b"", {}

def candidate_url_variants(url: str) -> list[str]:
    p = urllib.parse.urlsplit(url)
    host = p.hostname or ""
    port = p.port
    path = p.path or "/"
    query = p.query
    hosts = [host]
    if host.startswith("www."):
        hosts.append(host[4:])
    elif host and not re.match(r"^\d+(?:\.\d+){3}$", host) and host not in {"localhost"}:
        hosts.append("www." + host)
    schemes = [p.scheme]
    if p.scheme == "https":
        schemes.append("http")
    elif p.scheme == "http":
        schemes.insert(0, "https")
    out = []
    for scheme in schemes:
        for h in hosts:
            netloc = h
            if port and not ((scheme == "http" and port == 80) or (scheme == "https" and port == 443)):
                netloc += f":{port}"
            u = urllib.parse.urlunsplit((scheme, netloc, path, query, ""))
            out.append(u)
    return stable_unique(out)


def parse_page(body: bytes, headers: dict[str, str], base_url: str) -> tuple[ResourceHTMLParser, str]:
    ctype = headers.get("content-type", "")
    charset = "utf-8"
    m = re.search(r"(?i)charset=([\w.\-]+)", ctype)
    if m:
        charset = m.group(1)
    try:
        text = body.decode(charset, errors="replace")
    except LookupError:
        text = body.decode("utf-8", errors="replace")
    parser = ResourceHTMLParser()
    try:
        parser.feed(text)
    except Exception:
        pass
    return parser, text


def is_soft_404(status: Optional[int], title: str, text: str) -> bool:
    if status in {404, 410}:
        return True
    sample = canonical_text((title + " " + text)[:12000])
    phrases = ["page not found", "404 not found", "we can t find that page", "this page doesn t exist", "page has moved"]
    return any(p in sample for p in phrases)


def contact_links(parser: ResourceHTMLParser, final_url: str) -> list[str]:
    scored: list[tuple[int, str]] = []
    base_host = url_host(final_url)
    for href, anchor in parser.links:
        if not href or href.startswith(('#', 'javascript:')):
            continue
        if href.lower().startswith(('mailto:', 'tel:')):
            continue
        full = normalize_url(urllib.parse.urljoin(final_url, href))
        if not full or url_host(full) != base_host:
            continue
        hay = canonical_text(anchor + " " + urllib.parse.urlsplit(full).path)
        score = 0
        for term, pts in (("contact", 10), ("get help", 9), ("help", 5), ("about", 5), ("intake", 8), ("apply", 6), ("locations", 5), ("location", 4), ("staff", 3), ("team", 3)):
            if term in hay:
                score += pts
        if score:
            scored.append((score, full))
    scored.sort(key=lambda x: (-x[0], len(x[1])))
    return stable_unique(u for _, u in scored)[:6]


def discover_contacts(parser: ResourceHTMLParser, raw_html: str) -> tuple[list[str], list[str]]:
    emails = split_emails(parser.text + " " + raw_html)
    phones = split_phones(parser.text)
    for href, _ in parser.links:
        if href.lower().startswith("mailto:"):
            emails.extend(split_emails(urllib.parse.unquote(href[7:])))
        elif href.lower().startswith("tel:"):
            p = normalize_phone(urllib.parse.unquote(href[4:]))
            if p:
                phones.append(p)
    return stable_unique(emails), stable_unique(phones)



ADDRESS_PATTERNS = [
    re.compile(r"(?i)\b\d{1,6}\s+[A-Z0-9][A-Z0-9 .,'#\-]{2,70}\s(?:Street|St\.?|Avenue|Ave\.?|Road|Rd\.?|Boulevard|Blvd\.?|Drive|Dr\.?|Lane|Ln\.?|Court|Ct\.?|Way|Parkway|Pkwy\.?|Highway|Hwy\.?)\s*(?:Suite|Ste\.?|Unit|#)?\s*[A-Z0-9\-]*\s*,\s*[A-Z .'-]{2,40}\s*,\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?\b"),
    re.compile(r"(?i)\bP\.?\s*O\.?\s*Box\s+\d+[A-Z]?\s*,\s*[A-Z .'-]{2,40}\s*,\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?\b"),
]

def discover_addresses(text: str) -> list[str]:
    out = []
    for pat in ADDRESS_PATTERNS:
        out.extend(normalize_space(m.group(0)) for m in pat.finditer(text or ""))
    return stable_unique(out)


def discover_contact_names(parser: ResourceHTMLParser) -> list[str]:
    out = []
    generic = {"email us", "contact us", "send email", "email", "contact", "staff", "team", "click here"}
    for href, anchor in parser.links:
        if not href.lower().startswith("mailto:"):
            continue
        a = normalize_space(anchor)
        if not a or a.lower() in generic or EMAIL_RE.fullmatch(a):
            continue
        # Keep only short human-looking anchor text; never infer a person from an address.
        if 2 <= len(a.split()) <= 5 and len(a) <= 80 and re.search(r"[A-Za-z]", a):
            out.append(a)
    return stable_unique(out)


def search_web_candidates(org_name: str, timeout: float) -> tuple[list[str], HTTPAttempt, str]:
    """Bounded, best-effort public web discovery with no API key.

    Search results are candidates only. They are never accepted as the official organization
    site until a subsequent page verification aligns the organization name/contact evidence.
    """
    global _last_search_time
    q = urllib.parse.quote_plus(f'"{org_name}" official contact')
    url = f"https://html.duckduckgo.com/html/?q={q}"
    # Serialize public search fallback lightly to reduce self-inflicted rate limiting.
    with _search_lock:
        gap = time.monotonic() - _last_search_time
        if gap < 0.35:
            time.sleep(0.35 - gap)
        attempt, body, headers = http_attempt(url, "GET", timeout, read_body=True)
        _last_search_time = time.monotonic()
    if attempt.outcome != "HTTP_RESPONSE" or not body:
        return [], attempt, "Search endpoint did not return usable HTML."
    parser, raw = parse_page(body, headers, attempt.final_url or url)
    scored = []
    for href, anchor in parser.links:
        if not href:
            continue
        full = href
        try:
            pu = urllib.parse.urlsplit(href)
            qs = urllib.parse.parse_qs(pu.query)
            if "uddg" in qs:
                full = urllib.parse.unquote(qs["uddg"][0])
        except Exception:
            pass
        full = normalize_url(full)
        if not full:
            continue
        host = url_host(full)
        if not host or "duckduckgo.com" in host:
            continue
        sim = name_similarity(org_name, anchor + " " + host.replace(".", " "))
        scored.append((sim, full))
    scored.sort(key=lambda x: (-x[0], len(x[1])))
    return stable_unique(u for _, u in scored)[:6], attempt, f"Search returned {len(scored)} usable candidate links."

def verify_url(url: str, org_name: str, timeout: float, retries: int,
               cache: Optional[VerificationCache], discovery_method: str = "SOURCE") -> PageEvidence:
    canonical = normalize_url(url)
    if not canonical:
        return PageEvidence(url, "", "MALFORMED_SOURCE_VALUE", "URL could not be normalized.", "NOT_TESTED", [], [], discovery_method=discovery_method)
    cache_key = hashlib.sha256(f"v{VERSION}|{canonical}|{org_name}|{discovery_method}".encode()).hexdigest()
    if cache:
        cached = cache.get(cache_key)
        if cached:
            try:
                cached["attempts"] = [HTTPAttempt(**a) for a in cached.get("attempts", [])]
                return PageEvidence(**cached)
            except Exception:
                pass

    attempts: list[HTTPAttempt] = []
    best_body = b""
    best_headers: dict[str, str] = {}
    best_attempt: Optional[HTTPAttempt] = None
    variants = candidate_url_variants(canonical)
    # Hard bound: original + host/scheme alternates. Repeated failures do not get an
    # unbounded retry tree. retries applies only to transient transport/5xx failures.
    max_variant_count = min(4, len(variants))

    def consider(at: HTTPAttempt, body: bytes, headers: dict[str, str]):
        nonlocal best_attempt, best_body, best_headers
        if at.outcome != "HTTP_RESPONSE":
            return
        priority = 9
        st = at.status or 0
        if 200 <= st < 400:
            priority = 0
        elif st in {401, 403, 429}:
            priority = 1
        elif st in {404, 410}:
            priority = 3
        elif 500 <= st < 600:
            priority = 5
        old_priority = 99
        if best_attempt:
            bst = best_attempt.status or 0
            old_priority = 0 if 200 <= bst < 400 else 1 if bst in {401,403,429} else 3 if bst in {404,410} else 5 if 500 <= bst < 600 else 9
        if best_attempt is None or priority < old_priority or (priority == old_priority and len(body) > len(best_body)):
            best_attempt, best_body, best_headers = at, body, headers

    for variant in variants[:max_variant_count]:
        for attempt_no in range(retries + 1):
            at, body, headers = http_attempt(variant, "GET", timeout, read_body=True)
            attempts.append(at)
            consider(at, body, headers)
            st = at.status or 0
            if at.outcome == "HTTP_RESPONSE":
                if 200 <= st < 400 or st in {401, 403, 429, 404, 410}:
                    break
                if not (500 <= st < 600):
                    break
            if attempt_no < retries:
                time.sleep(min(1.0, 0.2 * (2 ** attempt_no)) + random.random() * 0.05)
        st = best_attempt.status if best_attempt else None
        if st and (200 <= st < 400 or st in {401, 403, 429}):
            break
        # 404 on a deep link triggers root fallback before trying unrelated variants.
        if st in {404, 410} and urllib.parse.urlsplit(canonical).path not in {"", "/"}:
            ru = root_url(variant)
            root_at, body, headers = http_attempt(ru, "GET", timeout, read_body=True)
            attempts.append(root_at)
            consider(root_at, body, headers)
            if root_at.status and (200 <= root_at.status < 400 or root_at.status in {401,403,429}):
                break

    # DNS is a dead-site confirmation fallback, not an up-front delay.
    dns_checks = {}
    all_addrs: list[str] = []
    http_responses = [a for a in attempts if a.outcome == "HTTP_RESPONSE" and a.status is not None]
    if not http_responses:
        for vh in stable_unique((urllib.parse.urlsplit(v).hostname or "") for v in variants[:max_variant_count]):
            if not vh:
                continue
            ds, da, de = dns_resolve(vh, timeout=min(timeout, 3.5))
            dns_checks[vh] = {"status": ds, "addresses": da, "error": de}
            all_addrs.extend(da)
    else:
        final_host = urllib.parse.urlsplit((best_attempt.final_url if best_attempt else canonical) or canonical).hostname or ""
        ds, da, de = dns_resolve(final_host, timeout=min(timeout, 2.5))
        dns_checks[final_host] = {"status": ds, "addresses": da, "error": de}
        all_addrs.extend(da)
    dns_states = [x["status"] for x in dns_checks.values()]
    if dns_states and all(x == "DNS_FAILURE" for x in dns_states):
        dns_status = "ALL_HOST_VARIANTS_DNS_FAILURE"
    elif any(x == "RESOLVES" for x in dns_states):
        dns_status = "RESOLVES"
    elif any(x in {"DNS_HARD_TIMEOUT", "DNS_TEMPORARY_FAILURE", "DNS_ERROR"} for x in dns_states):
        dns_status = "INCONCLUSIVE_DNS"
    else:
        dns_status = dns_states[0] if dns_states else "NOT_TESTED"
    addrs = stable_unique(all_addrs)
    dns_error = "; ".join(f"{h}: {x['error']}" for h, x in dns_checks.items() if x.get("error"))

    parser = ResourceHTMLParser()
    raw_html = ""
    title = site_name = ""
    discovered_urls: list[str] = []
    discovered_emails: list[str] = []
    discovered_phones: list[str] = []
    discovered_addresses: list[str] = []
    discovered_names: list[str] = []
    contact_checked: list[str] = []
    combined_text = ""
    soft404 = False
    sim = 0.0

    if best_attempt and best_body:
        parser, raw_html = parse_page(best_body, best_headers, best_attempt.final_url or canonical)
        title = parser.title
        site_name = parser.meta.get("og:site_name", "") or parser.meta.get("application-name", "")
        combined_text = parser.text
        soft404 = is_soft_404(best_attempt.status, title, parser.text)
        discovered_urls = contact_links(parser, best_attempt.final_url or canonical)
        e, ph = discover_contacts(parser, raw_html)
        discovered_emails.extend(e); discovered_phones.extend(ph)
        discovered_addresses.extend(discover_addresses(parser.text))
        discovered_names.extend(discover_contact_names(parser))
        candidate_name = site_name or title
        if candidate_name:
            sim = name_similarity(org_name, candidate_name)

        # Follow a small number of same-domain contact/intake pages. Each is a single GET;
        # failure of one contact page never invalidates the main site or stops the others.
        for cu in discovered_urls[:3]:
            try:
                cat, cbody, cheaders = http_attempt(cu, "GET", timeout, read_body=True)
                attempts.append(cat)
                contact_checked.append(cu)
                if cat.outcome == "HTTP_RESPONSE" and cat.status and 200 <= cat.status < 400 and cbody:
                    cp, craw = parse_page(cbody, cheaders, cat.final_url or cu)
                    ce, cph = discover_contacts(cp, craw)
                    discovered_emails.extend(ce); discovered_phones.extend(cph)
                    discovered_addresses.extend(discover_addresses(cp.text))
                    discovered_names.extend(discover_contact_names(cp))
                    combined_text = normalize_space(combined_text + " " + cp.text)
            except Exception:
                continue

    http_responses = [a for a in attempts if a.outcome == "HTTP_RESPONSE" and a.status is not None]
    positive = [a for a in http_responses if 200 <= int(a.status) < 400]
    blocked = [a for a in http_responses if a.status in {401, 403, 429}]
    gone = [a for a in http_responses if a.status in {404, 410}]
    transient = [a for a in http_responses if a.status and 500 <= a.status < 600]
    transport_errors = [a for a in attempts if a.outcome in {"TRANSPORT_ERROR", "ERROR"}]

    if positive and not soft404:
        website_status = "VERIFIED_REACHABLE"
        status_reason = f"Received live HTTP response ({positive[0].status}); DNS={dns_status}."
    elif blocked:
        website_status = "VERIFIED_SERVER_EXISTS_ACCESS_RESTRICTED"
        status_reason = f"Server answered with access/rate restriction ({blocked[0].status}); this is evidence the server exists."
    elif positive and soft404:
        website_status = "REACHABLE_PAGE_MISSING"
        status_reason = "Server is reachable, but fetched content looks like a missing-page response."
    elif gone and urllib.parse.urlsplit(canonical).path not in {"", "/"}:
        website_status = "PAGE_MISSING_OR_MOVED"
        status_reason = "Supplied page returned 404/410; root/alternate variants were separately probed."
    elif transient:
        website_status = "INCONCLUSIVE_SERVER_ERROR"
        status_reason = "Server answered with 5xx; treated as potentially temporary."
    elif dns_status == "ALL_HOST_VARIANTS_DNS_FAILURE" and not http_responses:
        website_status = "DEAD_CONFIRMED_DNS"
        status_reason = f"All tested hostname variants failed DNS and no HTTP variant returned a response. {dns_error}".strip()
    elif transport_errors:
        website_status = "INCONCLUSIVE_NETWORK_FAILURE"
        status_reason = "No usable HTTP response after bounded retries/variants; timeout/TLS/transport failures do not prove a dead site."
    else:
        website_status = "INCONCLUSIVE"
        status_reason = "Insufficient evidence to verify or deny reachability."

    ev = PageEvidence(
        requested_url=url, canonical_url=canonical, website_status=website_status,
        status_reason=status_reason, dns_status=dns_status, dns_addresses=addrs,
        attempts=attempts, title=title, site_name=site_name,
        text_excerpt=normalize_space(combined_text)[:1600] if combined_text else "",
        discovered_urls=stable_unique(discovered_urls),
        discovered_emails=stable_unique(discovered_emails),
        discovered_phones=stable_unique(discovered_phones),
        discovered_addresses=stable_unique(discovered_addresses),
        discovered_contact_names=stable_unique(discovered_names),
        contact_pages_checked=stable_unique(contact_checked), discovery_method=discovery_method,
        name_similarity=round(sim, 3), soft_404=soft404,
    )
    if cache:
        cache.put(cache_key, asdict(ev))
    return ev


def email_domain_status(email: str, timeout: float) -> dict[str, Any]:
    """Check syntax and domain mail-routing plausibility without pretending to verify a mailbox.

    MX/A DNS evidence can show that a domain is configured to receive mail. It cannot prove
    that a particular mailbox exists, so statuses deliberately stop at domain plausibility
    unless the exact address is corroborated on the organization's official site.
    """
    if not EMAIL_RE.fullmatch(email or ""):
        return {"value": email, "format_status": "MALFORMED", "domain_status": "NOT_TESTED", "status": "MALFORMED_SOURCE_VALUE"}
    domain = email.rsplit("@", 1)[1].lower()
    result: dict[str, Any] = {"value": email, "format_status": "VALID_SYNTAX", "mx_records": []}
    try:
        import dns.resolver  # type: ignore
        resolver = dns.resolver.Resolver(configure=True)
        resolver.timeout = min(max(timeout, 1.0), 5.0)
        resolver.lifetime = min(max(timeout, 1.0), 6.0)
        try:
            answers = resolver.resolve(domain, "MX")
            mx = sorted({str(r.exchange).rstrip(".").lower() for r in answers if getattr(r, "exchange", None)})
            if mx:
                result.update({"domain_status": "MX_RESOLVES", "mx_records": mx, "status": "PLAUSIBLE_MAIL_DOMAIN_MX"})
                return result
        except dns.resolver.NXDOMAIN as e:
            result.update({"domain_status": "DNS_FAILURE", "status": "DOMAIN_DNS_FAILURE", "error": f"NXDOMAIN: {e}"})
            return result
        except dns.resolver.NoAnswer:
            # RFC mail delivery may fall back to A/AAAA when no MX exists.
            pass
        except (dns.resolver.Timeout, dns.resolver.NoNameservers) as e:
            result["mx_error"] = f"{e.__class__.__name__}: {e}"
        except Exception as e:
            result["mx_error"] = f"{e.__class__.__name__}: {e}"
    except Exception:
        result["mx_status"] = "OPTIONAL_DNSPYTHON_UNAVAILABLE"

    dns_status, addrs, err = dns_resolve(domain, min(timeout, 5.0))
    if dns_status == "RESOLVES":
        status = "PLAUSIBLE_MAIL_DOMAIN_A_FALLBACK"
    elif dns_status == "DNS_FAILURE":
        status = "DOMAIN_DNS_FAILURE"
    else:
        status = "INCONCLUSIVE_DOMAIN"
    result.update({"domain_status": dns_status, "domain_addresses": addrs, "status": status, "error": err or result.get("mx_error", "")})
    return result


def page_blob(pages: list[PageEvidence]) -> str:
    parts = []
    for p in pages:
        parts += [p.title, p.site_name, p.text_excerpt, " ".join(p.discovered_emails), " ".join(p.discovered_phones)]
    return canonical_text(" ".join(parts))


def phone_digits(p: str) -> str:
    return re.sub(r"\D", "", p.split(" x")[0])[-10:]


def phone_plan_assessment(phone: str) -> dict[str, Any]:
    """Numbering-plan plausibility only; never claims the number is assigned or answered."""
    base = {"numbering_plan": "NANP_BASIC", "plan_possible": bool(phone_digits(phone)), "plan_valid": None, "region": ""}
    try:
        import phonenumbers  # type: ignore
        parsed = phonenumbers.parse(phone.split(" x")[0], "US")
        base["numbering_plan"] = "LIBPHONENUMBER"
        base["plan_possible"] = bool(phonenumbers.is_possible_number(parsed))
        base["plan_valid"] = bool(phonenumbers.is_valid_number(parsed))
        base["region"] = phonenumbers.region_code_for_number(parsed) or ""
        base["number_type"] = str(phonenumbers.number_type(parsed)).split(".")[-1]
    except Exception as e:
        base["plan_check_note"] = "phonenumbers unavailable or parse failed; retained conservative NANP syntax check"
    return base


def verify_phones(phones: list[str], pages: list[PageEvidence]) -> list[dict[str, Any]]:
    blob_digits = re.sub(r"\D", "", " ".join([p.text_excerpt for p in pages] + [" ".join(p.discovered_phones) for p in pages]))
    discovered = {phone_digits(x) for p in pages for x in p.discovered_phones}
    out = []
    for p in phones:
        d = phone_digits(p)
        corroborated = d in discovered or (d and d in blob_digits)
        plan = phone_plan_assessment(p)
        syntax_status = "PLAUSIBLE_NANP" if d else "MALFORMED"
        if plan.get("numbering_plan") == "LIBPHONENUMBER":
            if plan.get("plan_valid"):
                syntax_status = "VALID_NUMBERING_PLAN"
            elif plan.get("plan_possible"):
                syntax_status = "POSSIBLE_NUMBERING_PLAN"
            else:
                syntax_status = "IMPLAUSIBLE_NUMBERING_PLAN"
        row = {
            "value": p,
            "format_status": syntax_status,
            "corroboration": "OFFICIAL_SITE" if corroborated else "NOT_CORROBORATED",
            "status": "VERIFIED_ON_OFFICIAL_SITE" if corroborated else ("PLAUSIBLE_UNVERIFIED" if plan.get("plan_possible") else "IMPLAUSIBLE_SOURCE_VALUE"),
        }
        row.update(plan)
        out.append(row)
    # Surface newly discovered official-site phones without overwriting source values.
    known = {phone_digits(p) for p in phones}
    for p in stable_unique(x for page in pages for x in page.discovered_phones):
        if phone_digits(p) not in known:
            row = {"value": p, "format_status": "PLAUSIBLE_NANP", "corroboration": "OFFICIAL_SITE_DISCOVERED", "status": "DISCOVERED_ON_OFFICIAL_SITE"}
            row.update(phone_plan_assessment(p))
            out.append(row)
    return out


def verify_emails(emails: list[str], pages: list[PageEvidence], timeout: float, network: bool) -> list[dict[str, Any]]:
    discovered = {e.lower() for p in pages for e in p.discovered_emails}
    out = []
    for e in emails:
        base = email_domain_status(e, timeout) if network else {
            "value": e, "format_status": "VALID_SYNTAX" if EMAIL_RE.fullmatch(e) else "MALFORMED",
            "domain_status": "NOT_TESTED_OFFLINE", "status": "PLAUSIBLE_UNVERIFIED" if EMAIL_RE.fullmatch(e) else "MALFORMED_SOURCE_VALUE"
        }
        if e.lower() in discovered:
            base["corroboration"] = "OFFICIAL_SITE"
            base["status"] = "VERIFIED_ON_OFFICIAL_SITE"
        else:
            base["corroboration"] = "NOT_CORROBORATED"
        out.append(base)
    known = {e.lower() for e in emails}
    for e in stable_unique(x for p in pages for x in p.discovered_emails):
        if e.lower() not in known:
            base = email_domain_status(e, timeout) if network else {"value": e, "format_status": "VALID_SYNTAX", "domain_status": "NOT_TESTED_OFFLINE"}
            base["corroboration"] = "OFFICIAL_SITE_DISCOVERED"
            base["status"] = "DISCOVERED_ON_OFFICIAL_SITE"
            out.append(base)
    return out


def viability_assessment(description: str, pages: list[PageEvidence]) -> dict[str, Any]:
    source_text = canonical_text(description)
    live_text = canonical_text(" ".join(p.text_excerpt for p in pages if p.website_status.startswith("VERIFIED") or p.website_status == "REACHABLE_PAGE_MISSING"))
    positive: list[dict[str, Any]] = []
    negative: list[dict[str, Any]] = []
    score = 50

    # Negation-safe handling: a phrase like "no congregate shelter" does not become a congregate barrier.
    for phrase, weight in POSITIVE_SIGNALS.items():
        src = phrase in source_text
        live = phrase in live_text
        if src or live:
            score += weight
            positive.append({"signal": phrase, "weight": weight, "source": "LIVE_SITE" if live else "SOURCE_TEXT"})
    for phrase, weight in NEGATIVE_SIGNALS.items():
        src = phrase in source_text
        live = phrase in live_text
        if src or live:
            score += weight
            negative.append({"signal": phrase, "weight": weight, "source": "LIVE_SITE" if live else "SOURCE_TEXT"})

    # Generic barrier words require local phrase context and ignore explicit negation.
    contextual_barriers = [
        (r"(?<!no )(?<!without )\blease required\b", "lease required", -10),
        (r"(?<!no )\beviction notice\b", "eviction notice", -6),
        (r"\blandlord documentation\b", "landlord documentation", -6),
    ]
    for pat, label, weight in contextual_barriers:
        if re.search(pat, source_text) or re.search(pat, live_text):
            score += weight
            negative.append({"signal": label, "weight": weight, "source": "LIVE_SITE" if re.search(pat, live_text) else "SOURCE_TEXT"})

    score = max(0, min(100, score))
    if score >= 68:
        rating = "HIGHER_PRACTICAL_VIABILITY"
    elif score <= 35:
        rating = "LOWER_PRACTICAL_VIABILITY"
    else:
        rating = "CONDITIONAL_OR_UNKNOWN"
    evidence_quality = "LIVE_SITE_SUPPORTED" if any(x["source"] == "LIVE_SITE" for x in positive + negative) else "SOURCE_ONLY"
    return {"score": score, "rating": rating, "evidence_quality": evidence_quality, "positive_signals": positive, "barrier_signals": negative}


def suggested_name_from_pages(source_name: str, pages: list[PageEvidence]) -> str:
    candidates = []
    for p in pages:
        for c in (p.site_name, p.title):
            c = normalize_space(c)
            if not c:
                continue
            # Strip common title suffixes conservatively.
            for sep in (" | ", " — ", " – ", " - "):
                if sep in c:
                    first = c.split(sep, 1)[0].strip()
                    if 2 <= len(first) <= 100:
                        candidates.append(first)
            candidates.append(c)
    candidates = stable_unique(candidates)
    ranked = sorted(((name_similarity(source_name, c), c) for c in candidates), reverse=True)
    if not ranked:
        return ""
    sim, cand = ranked[0]
    if sim >= 0.58 and 2 <= len(cand) <= 120:
        return cand
    # If source name itself is malformed/URL-like, a site name can still be useful but is marked suggestion only.
    if (len(source_name) > 140 or re.match(r"(?i)^https?://", source_name) or BARE_DOMAIN_RE.fullmatch(source_name)) and len(cand) <= 120:
        return cand
    return ""


def organization_verdict(record: NormalizedRecord, pages: list[PageEvidence]) -> tuple[str, str]:
    if not pages:
        if record.urls:
            return "INCONCLUSIVE", "No live page evidence was collected."
        if record.phones or record.emails:
            return "UNVERIFIED_CONTACT_ONLY", "No website candidate; contact values remain source-derived until independently corroborated."
        return "INSUFFICIENT_SOURCE_DATA", "No usable website, phone, or email was present or discovered."
    reachable = [p for p in pages if p.website_status in {"VERIFIED_REACHABLE", "VERIFIED_SERVER_EXISTS_ACCESS_RESTRICTED"}]
    aligned = [p for p in reachable if p.name_similarity >= 0.50]
    if aligned:
        return "VERIFIED", f"Reachable site and organization-name alignment found (best similarity {max(p.name_similarity for p in aligned):.3f})."
    if reachable:
        # Contact corroboration can establish identity when title/site-name is generic or blocked.
        discovered_phone_digits = {phone_digits(x) for p in reachable for x in p.discovered_phones}
        if discovered_phone_digits & {phone_digits(x) for x in record.phones}:
            return "VERIFIED", "Reachable site corroborated a source phone number."
        discovered_emails = {x.lower() for p in reachable for x in p.discovered_emails}
        if discovered_emails & {x.lower() for x in record.emails}:
            return "VERIFIED", "Reachable site corroborated a source email address."
        return "PARTIALLY_VERIFIED", "A supplied website is live, but organization identity was not strongly corroborated from available page content."
    dead = [p for p in pages if p.website_status.startswith("DEAD_CONFIRMED")]
    inconclusive = [p for p in pages if p.website_status.startswith("INCONCLUSIVE")]
    if dead and len(dead) == len(pages):
        return "WEBSITE_DEAD_CONFIRMED", "All supplied website hosts failed strong DNS-based existence checks; other contact channels may still remain usable."
    if inconclusive:
        return "INCONCLUSIVE", "Network/TLS/server failures prevented a reliable organization verdict."
    return "PARTIALLY_VERIFIED", "Some endpoint evidence exists, but identity/reachability is incomplete."


def verify_record(record: NormalizedRecord, group_meta: dict[str, dict[str, str]], network: bool,
                  timeout: float, retries: int, cache: Optional[VerificationCache],
                  search_fallback: bool = True) -> VerificationRecord:
    errors: list[str] = []
    discovery_notes: list[str] = []
    pages: list[PageEvidence] = []
    if network:
        for u in record.urls:
            try:
                pages.append(verify_url(u, record.name, timeout, retries, cache, discovery_method="SOURCE"))
            except Exception as e:
                errors.append(f"URL verification error for {u}: {e.__class__.__name__}: {e}")
    else:
        for u in record.urls:
            pages.append(PageEvidence(
                requested_url=u, canonical_url=normalize_url(u), website_status="INCONCLUSIVE_OFFLINE",
                status_reason="Network verification disabled; no live claim made.", dns_status="NOT_TESTED_OFFLINE",
                dns_addresses=[], attempts=[], discovery_method="SOURCE"
            ))

    # Search discovery is a fallback, never a substitute for identity evidence.
    live_source = [p for p in pages if p.discovery_method == "SOURCE" and p.website_status in {
        "VERIFIED_REACHABLE", "VERIFIED_SERVER_EXISTS_ACCESS_RESTRICTED"
    }]
    should_search = network and search_fallback and not live_source and len(name_tokens(record.name)) >= 2
    if should_search:
        try:
            candidates, search_attempt, note = search_web_candidates(record.name, timeout=min(timeout, 8.0))
            discovery_notes.append(f"Search fallback: {note} status={search_attempt.status or search_attempt.outcome}.")
            accepted = 0
            checked = 0
            source_phone_set = {phone_digits(x) for x in record.phones}
            source_email_set = {x.lower() for x in record.emails}
            source_name_host = canonical_text(record.name).replace(" ", "")
            for cand in candidates[:3]:
                checked += 1
                try:
                    pe = verify_url(cand, record.name, timeout, max(0, min(retries, 1)), cache, discovery_method="SEARCH_FALLBACK")
                except Exception as e:
                    discovery_notes.append(f"Search candidate {cand}: verification error {e.__class__.__name__}.")
                    continue
                found_phones = {phone_digits(x) for x in pe.discovered_phones}
                found_emails = {x.lower() for x in pe.discovered_emails}
                host_flat = canonical_text(url_host(pe.canonical_url)).replace(" ", "")
                identity_match = (
                    pe.name_similarity >= 0.58
                    or bool(source_phone_set & found_phones)
                    or bool(source_email_set & found_emails)
                    or (host_flat and len(host_flat) >= 5 and host_flat in source_name_host)
                )
                if identity_match and pe.website_status in {
                    "VERIFIED_REACHABLE", "VERIFIED_SERVER_EXISTS_ACCESS_RESTRICTED", "REACHABLE_PAGE_MISSING"
                }:
                    pages.append(pe)
                    accepted += 1
                    discovery_notes.append(f"Accepted search candidate {pe.canonical_url} (name_similarity={pe.name_similarity:.3f}).")
                    break
                discovery_notes.append(f"Rejected search candidate {pe.canonical_url}: insufficient identity corroboration (similarity={pe.name_similarity:.3f}).")
            if checked and accepted == 0:
                record.flags.append("search_fallback_no_confident_match")
            elif not candidates:
                record.flags.append("search_fallback_no_candidates")
        except Exception as e:
            discovery_notes.append(f"Search fallback failed non-fatally: {e.__class__.__name__}: {e}")
            record.flags.append("search_fallback_inconclusive")

    phones = verify_phones(record.phones, pages)
    try:
        emails = verify_emails(record.emails, pages, timeout, network)
    except Exception as e:
        emails = [{"value": x, "status": "INCONCLUSIVE", "error": str(e)} for x in record.emails]
        errors.append(f"Email verification stage error: {e.__class__.__name__}: {e}")

    # Official-site discoveries are surfaced independently from source fields.
    addresses = [
        {"value": a, "status": "DISCOVERED_ON_OFFICIAL_SITE", "source_url": p.canonical_url}
        for p in pages for a in p.discovered_addresses
    ]
    seen_addr = set(); addresses = [x for x in addresses if not (x["value"] in seen_addr or seen_addr.add(x["value"]))]
    contact_names = [
        {"value": n, "status": "DISCOVERED_ON_OFFICIAL_SITE", "source_url": p.canonical_url}
        for p in pages for n in p.discovered_contact_names
    ]
    seen_names = set(); contact_names = [x for x in contact_names if not (x["value"] in seen_names or seen_names.add(x["value"]))]

    org_status, org_reason = organization_verdict(record, pages)
    suggestion = suggested_name_from_pages(record.name, pages)
    viability = viability_assessment(record.description, pages)
    gm = group_meta.get(record.record_id, {"group_id": "", "confidence": ""})
    flags = list(record.flags)
    if not record.urls:
        flags.append("no_website_in_source_or_context")
    if not record.phones:
        flags.append("no_parseable_phone_in_source_or_context")
    if not record.emails:
        flags.append("no_parseable_email_in_source_or_context")
    if suggestion and canonical_text(suggestion) != canonical_text(record.name):
        flags.append("website_suggests_name_cleanup")
    if all(p.website_status == "INCONCLUSIVE_OFFLINE" for p in pages) and pages:
        flags.append("live_network_not_tested")
    if any(p.discovery_method == "SEARCH_FALLBACK" for p in pages):
        flags.append("website_discovered_by_search_and_identity_checked")

    return VerificationRecord(
        record_id=record.record_id, name=record.name, suggested_name=suggestion,
        category=record.category, organization_status=org_status, organization_reason=org_reason,
        urls=[asdict(p) for p in pages], phones=phones, emails=emails,
        addresses=addresses, contact_names=contact_names, viability=viability,
        duplicate_group_id=gm.get("group_id", ""), duplicate_confidence=gm.get("confidence", ""),
        flags=stable_unique(flags), source_files=record.source_files, source_indexes=record.source_indexes,
        source_document=record.source_document, description=record.description,
        discovery_notes=discovery_notes, errors=errors,
    )


def write_json_atomic(path: Path, obj: Any):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    with tmp.open("w", encoding="utf-8", newline="\n") as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)
        f.write("\n")
    os.replace(tmp, path)


def write_jsonl_atomic(path: Path, rows: Iterable[dict[str, Any]]):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    with tmp.open("w", encoding="utf-8", newline="\n") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")
    os.replace(tmp, path)


def safe_md(s: str) -> str:
    return normalize_space(s).replace("|", "\\|").replace("\n", " ")


def summarize(results: list[VerificationRecord], parse_issues: list[ParseIssue], ambiguous: list[dict[str, Any]],
              raw_count: int, normalized_count: int, output_dir: Path, network: bool) -> dict[str, Any]:
    org_counts = Counter(r.organization_status for r in results)
    flag_counts = Counter(f for r in results for f in r.flags)
    website_counts = Counter(
        u.get("website_status", "UNKNOWN") for r in results for u in r.urls
    )
    total_errors = sum(len(r.errors) for r in results)
    summary = {
        "generated_at": utc_now(), "verifier_version": VERSION, "network_enabled": network,
        "raw_records_loaded": raw_count, "records_after_strong_dedup": normalized_count,
        "records_output": len(results), "organization_status_counts": dict(org_counts),
        "website_status_counts": dict(website_counts), "parse_issue_count": len(parse_issues),
        "ambiguous_duplicate_pairs": len(ambiguous), "record_error_count": total_errors,
        "top_flags": dict(flag_counts.most_common(25)),
    }
    write_json_atomic(output_dir / "verification_summary.json", summary)

    md = []
    md.append("# Resource Verification Summary\n")
    md.append(f"Generated: {summary['generated_at']}  ")
    md.append(f"Verifier: {VERSION}  ")
    md.append(f"Network verification: {'enabled' if network else 'disabled (all live states remain inconclusive)'}\n")
    md.append("## Processing integrity\n")
    md.append(f"- Raw records loaded: **{raw_count}**")
    md.append(f"- Records after strong-evidence deduplication: **{normalized_count}**")
    md.append(f"- Parse/recovery issues retained for review: **{len(parse_issues)}**")
    md.append(f"- Possible duplicates deliberately held separate: **{len(ambiguous)}**")
    md.append(f"- Per-record stage errors retained without aborting run: **{total_errors}**\n")
    md.append("## Organization verification states\n")
    for k, v in org_counts.most_common():
        md.append(f"- **{k}:** {v}")
    md.append("\n## Website endpoint states\n")
    for k, v in website_counts.most_common():
        md.append(f"- **{k}:** {v}")
    md.append("\n## Records needing the most cleanup\n")
    md.append("| Resource | Organization status | Key flags |")
    md.append("|---|---|---|")
    risky = sorted(results, key=lambda r: (
        r.organization_status not in {"INSUFFICIENT_SOURCE_DATA", "INCONCLUSIVE", "PARTIALLY_VERIFIED", "WEBSITE_DEAD_CONFIRMED"},
        -len(r.flags), r.name.lower()
    ))
    for r in risky[:30]:
        md.append(f"| {safe_md(r.name)[:120]} | {r.organization_status} | {safe_md(', '.join(r.flags[:6]))} |")
    (output_dir / "verification_summary.md").write_text("\n".join(md) + "\n", encoding="utf-8")
    return summary


def csv_flat_row(r: VerificationRecord) -> dict[str, Any]:
    url_states = [f"{x.get('canonical_url') or x.get('requested_url')} => {x.get('website_status')}" for x in r.urls]
    return {
        "Record_ID": r.record_id,
        "Resource_Name": r.name,
        "Suggested_Name": r.suggested_name,
        "Category": r.category,
        "Organization_Status": r.organization_status,
        "Organization_Reason": r.organization_reason,
        "URLs": " | ".join(x.get("canonical_url") or x.get("requested_url", "") for x in r.urls),
        "URL_Statuses": " | ".join(url_states),
        "Phones": " | ".join(x.get("value", "") for x in r.phones),
        "Phone_Statuses": " | ".join(f"{x.get('value')} => {x.get('status')}" for x in r.phones),
        "Emails": " | ".join(x.get("value", "") for x in r.emails),
        "Email_Statuses": " | ".join(f"{x.get('value')} => {x.get('status')}" for x in r.emails),
        "Addresses": " | ".join(x.get("value", "") for x in r.addresses),
        "Contact_Names": " | ".join(x.get("value", "") for x in r.contact_names),
        "Viability_Score": r.viability.get("score"),
        "Viability_Rating": r.viability.get("rating"),
        "Viability_Evidence": r.viability.get("evidence_quality"),
        "Duplicate_Group": r.duplicate_group_id,
        "Duplicate_Confidence": r.duplicate_confidence,
        "Flags": " | ".join(r.flags),
        "Source_Files": " | ".join(r.source_files),
        "Source_Indexes": " | ".join(map(str, r.source_indexes)),
        "Source_Document": r.source_document,
        "Description_Context": r.description,
        "Discovery_Notes": " | ".join(r.discovery_notes),
        "Errors": " | ".join(r.errors),
    }


def write_csv(path: Path, results: list[VerificationRecord]):
    rows = [csv_flat_row(r) for r in results]
    if not rows:
        path.write_text("", encoding="utf-8")
        return
    with path.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()), extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)


def emit_progress(callback: Optional[Any], event: str, **payload: Any) -> None:
    if callback is None:
        return
    try:
        callback({"event": event, "time": utc_now(), **payload})
    except Exception:
        # UI/logging code is never allowed to break verification.
        pass


def sha256_file(path: Path, chunk_size: int = 1024 * 1024) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        while True:
            chunk = f.read(chunk_size)
            if not chunk:
                break
            h.update(chunk)
    return h.hexdigest()


def dependency_report() -> dict[str, Any]:
    report: dict[str, Any] = {}
    packages = {"openpyxl": "openpyxl", "phonenumbers": "phonenumbers", "dnspython": "dns", "certifi": "certifi"}
    for dist, module in packages.items():
        available = importlib.util.find_spec(module) is not None
        version = ""
        if available:
            try:
                version = importlib.metadata.version(dist)
            except Exception:
                version = "installed-version-unknown"
        report[dist] = {"available": available, "version": version}
    return report


def run_pipeline(inputs: list[Path], output_dir: Path, network: bool, workers: int,
                 timeout: float, retries: int, cache_ttl: int, search_fallback: bool = True,
                 progress_callback: Optional[Any] = None) -> dict[str, Any]:
    """Run the full audit while preserving every recoverable record and every uncertainty.

    progress_callback is deliberately optional and non-authoritative: UI/log failures cannot
    affect verification outcomes. The CLI remains backward-compatible with version 3.
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    parse_issues: list[ParseIssue] = []
    raw_records: list[RawRecord] = []
    started = time.time()
    emit_progress(progress_callback, "run_started", input_count=len(inputs), output_dir=str(output_dir))

    input_manifest: list[dict[str, Any]] = []
    for file_no, p in enumerate(inputs, 1):
        emit_progress(progress_callback, "parsing_file", index=file_no, total=len(inputs), path=str(p))
        if not p.exists():
            parse_issues.append(ParseIssue(str(p), "input", "Input file does not exist.", fatal=True))
            input_manifest.append({"path": str(p), "exists": False})
            continue
        try:
            stat = p.stat()
            manifest_row = {"path": str(p), "exists": True, "bytes": stat.st_size, "modified_epoch": stat.st_mtime}
            try:
                manifest_row["sha256"] = sha256_file(p)
            except Exception as e:
                manifest_row["sha256_error"] = f"{e.__class__.__name__}: {e}"
            input_manifest.append(manifest_row)
            recs, issues = parse_input(p)
            raw_records.extend(recs)
            parse_issues.extend(issues)
            emit_progress(progress_callback, "file_parsed", path=str(p), records=len(recs), issues=len(issues), total_raw_records=len(raw_records))
        except UnicodeDecodeError as e:
            parse_issues.append(ParseIssue(str(p), "decode", f"Text decode failed after recovery paths: {e}", fatal=True))
        except Exception as e:
            parse_issues.append(ParseIssue(str(p), "input", f"Unexpected parser error: {e.__class__.__name__}: {e}", fatal=True))

    base_manifest = {
        "generated_at": utc_now(),
        "verifier_version": VERSION,
        "python": sys.version,
        "platform": platform.platform(),
        "dependencies": dependency_report(),
        "settings": {
            "network": network, "workers": workers, "timeout_seconds": timeout,
            "retries": retries, "cache_ttl_hours": cache_ttl, "search_fallback": search_fallback,
        },
        "inputs": input_manifest,
    }
    write_json_atomic(output_dir / "run_manifest.json", base_manifest)

    if not raw_records:
        write_json_atomic(output_dir / "parse_issues.json", [asdict(x) for x in parse_issues])
        emit_progress(progress_callback, "run_failed", reason="No usable records loaded", parse_issues=len(parse_issues))
        raise RuntimeError("No usable records were loaded from any input. See parse_issues.json and run_manifest.json.")

    emit_progress(progress_callback, "normalizing", total=len(raw_records))
    normalized: list[NormalizedRecord] = []
    for rr in raw_records:
        try:
            normalized.append(normalize_raw(rr))
        except Exception as e:
            parse_issues.append(ParseIssue(rr.source_file, "normalize", f"Record {rr.source_index}: {e.__class__.__name__}: {e}", fatal=False))
            # Fallback record preserves raw material rather than disappearing.
            normalized.append(NormalizedRecord(
                record_id=hashlib.sha256(f"fallback|{rr.source_file}|{rr.source_index}".encode()).hexdigest()[:20],
                name=f"[NORMALIZATION ERROR #{rr.source_index}]", category="UNSPECIFIED", phones=[], emails=[], urls=[],
                description=text_value(rr.data), source_document="", source_files=[rr.source_file], source_indexes=[rr.source_index],
                raw_records=[rr.data], flags=["normalization_error_preserved"],
            ))

    emit_progress(progress_callback, "deduplicating", normalized_records=len(normalized))
    deduped, group_meta, ambiguous = dedupe_records(normalized)
    emit_progress(progress_callback, "deduplicated", raw_records=len(raw_records), deduped_records=len(deduped), ambiguous_pairs=len(ambiguous))
    cache = VerificationCache(output_dir / "verification_cache.sqlite3", ttl_hours=cache_ttl) if network else None
    results_by_index: dict[int, VerificationRecord] = {}

    def task(i: int, rec: NormalizedRecord):
        try:
            return i, verify_record(rec, group_meta, network, timeout, retries, cache, search_fallback=search_fallback)
        except Exception as e:
            # Last-resort record-level failsafe: preserve the record and error instead of aborting the run.
            gm = group_meta.get(rec.record_id, {})
            vr = VerificationRecord(
                record_id=rec.record_id, name=rec.name, suggested_name="", category=rec.category,
                organization_status="INCONCLUSIVE_INTERNAL_ERROR",
                organization_reason="Verification stage raised an error; source record was preserved.",
                urls=[], phones=[{"value": x, "status": "INCONCLUSIVE_INTERNAL_ERROR"} for x in rec.phones],
                emails=[{"value": x, "status": "INCONCLUSIVE_INTERNAL_ERROR"} for x in rec.emails],
                addresses=[], contact_names=[],
                viability=viability_assessment(rec.description, []), duplicate_group_id=gm.get("group_id", ""),
                duplicate_confidence=gm.get("confidence", ""), flags=stable_unique(rec.flags + ["verification_internal_error"]),
                source_files=rec.source_files, source_indexes=rec.source_indexes, source_document=rec.source_document,
                description=rec.description, discovery_notes=[],
                errors=[f"{e.__class__.__name__}: {e}", traceback.format_exc(limit=4)],
            )
            return i, vr

    emit_progress(progress_callback, "verification_started", total=len(deduped), network=network)
    try:
        with ThreadPoolExecutor(max_workers=max(1, workers)) as ex:
            futs = [ex.submit(task, i, rec) for i, rec in enumerate(deduped)]
            completed = 0
            for fut in as_completed(futs):
                i, result = fut.result()
                results_by_index[i] = result
                completed += 1
                emit_progress(progress_callback, "verification_progress", completed=completed, total=len(deduped), name=result.name, status=result.organization_status)
                if completed % 25 == 0 or completed == len(deduped):
                    print(f"Verified {completed}/{len(deduped)} records", file=sys.stderr)
                # Periodic atomic checkpoint is intentionally independent of final output.
                if completed % 50 == 0:
                    checkpoint = [asdict(results_by_index[k]) for k in sorted(results_by_index)]
                    write_json_atomic(output_dir / "checkpoint_partial.json", checkpoint)
    finally:
        if cache:
            cache.close()

    results = [results_by_index[i] for i in range(len(deduped))]
    emit_progress(progress_callback, "writing_outputs", records=len(results))
    write_json_atomic(output_dir / "verified_resources.json", [asdict(r) for r in results])
    write_jsonl_atomic(output_dir / "verified_resources.jsonl", (asdict(r) for r in results))
    write_csv(output_dir / "verified_resources.csv", results)
    write_json_atomic(output_dir / "parse_issues.json", [asdict(x) for x in parse_issues])
    write_json_atomic(output_dir / "possible_duplicates_review.json", ambiguous)
    write_json_atomic(output_dir / "normalized_records_snapshot.json", [asdict(r) for r in deduped])
    summary = summarize(results, parse_issues, ambiguous, len(raw_records), len(deduped), output_dir, network)
    summary["elapsed_seconds"] = round(time.time() - started, 3)
    summary["dependencies"] = dependency_report()
    write_json_atomic(output_dir / "verification_summary.json", summary)
    checkpoint = output_dir / "checkpoint_partial.json"
    if checkpoint.exists():
        checkpoint.unlink()
    base_manifest["completed_at"] = utc_now()
    base_manifest["elapsed_seconds"] = summary["elapsed_seconds"]
    base_manifest["summary"] = summary
    write_json_atomic(output_dir / "run_manifest.json", base_manifest)
    emit_progress(progress_callback, "run_complete", summary=summary)
    return summary


# -------------------------- integrated self-tests --------------------------
def _assert(cond: bool, msg: str):
    if not cond:
        raise AssertionError(msg)


def run_self_tests() -> None:
    import tempfile
    from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

    # Parsing variants.
    with tempfile.TemporaryDirectory() as td:
        t = Path(td)
        array = t / "array.json"
        array.write_text(json.dumps([{"Resource_Name": "Alpha", "URL/Location": "https://example.org", "Category": "X"}]), encoding="utf-8")
        recs, issues = parse_input(array)
        _assert(len(recs) == 1, "standard JSON array parser failed")

        wrapped = t / "wrapped.json"
        wrapped.write_text(json.dumps({"data": {"resources": [{"name": "Beta", "website": "beta.org", "category": "Y"}]}}), encoding="utf-8")
        recs, _ = parse_input(wrapped)
        _assert(len(recs) == 1, "wrapped JSON parser failed")

        dupjson = t / "duplicate_keys.json"
        dupjson.write_text('[{"Resource_Name":"First","Resource_Name":"Second","Category":"X","URL/Location":"https://example.org"}]', encoding="utf-8")
        recs, issues = parse_input(dupjson)
        _assert(len(recs) == 1 and recs[0].data.get("Resource_Name") == "Second", "duplicate-key JSON semantics changed unexpectedly")
        _assert(any(i.stage == "json_duplicate_keys" for i in issues), "duplicate JSON keys were not disclosed")

        jsonl = t / "rows.jsonl"
        jsonl.write_text('{"name":"A","category":"x","url":"a.org"}\nBROKEN\n{"name":"B","category":"x","url":"b.org"}\n', encoding="utf-8")
        recs, issues = parse_input(jsonl)
        _assert(len(recs) == 2, "JSONL partial-recovery parser failed")
        _assert(any(i.stage == "jsonl" for i in issues), "JSONL bad-line issue was not retained")

        csvp = t / "header_recovery.csv"
        csvp.write_text("Export generated 2026-08-31\nResource_Name,Category,Phone,URL/Location\nAlpha Center,X,602-555-1212,https://alpha.org\nBeta Center,Y,480-555-1212,https://beta.org\n", encoding="utf-8")
        recs, issues = parse_input(csvp)
        _assert(len(recs) == 2 and recs[0].data.get("Resource_Name") == "Alpha Center", "CSV header-row recovery failed")
        _assert(any("Detected header" in i.message for i in issues), "CSV header recovery was not disclosed")

        txtp = t / "blocks.txt"
        txtp.write_text("Alpha Help\nPhone: 602-555-1212\nWebsite: https://alpha.org\nProvides: Emergency help.\n\nBeta Help\nPhone: 480-555-1212\nWebsite: https://beta.org\nProvides: Housing help.\n", encoding="utf-8")
        recs, issues = parse_input(txtp)
        _assert(len(recs) == 2, "labeled text-block recovery failed")
        _assert(any(i.stage == "text_blocks" for i in issues), "heuristic text recovery was not disclosed")

        cp = t / "windows.csv"
        cp.write_bytes("Resource_Name,Category\nCaf\xe9 Help,X\n".encode("latin-1"))
        recs, issues = parse_input(cp)
        _assert(len(recs) == 1 and "Caf" in recs[0].data.get("Resource_Name", ""), "non-UTF8 decoding recovery failed")
        _assert(any(i.stage == "decode_recovery" for i in issues), "non-UTF8 recovery was not disclosed")

        if importlib.util.find_spec("openpyxl") is not None:
            import openpyxl  # type: ignore
            xp = t / "sheet.xlsx"
            wb = openpyxl.Workbook()
            ws = wb.active
            ws.append(["Resource export"])
            ws.append(["Resource_Name", "Category", "URL/Location"])
            ws.append(["Sheet Alpha", "X", "https://alpha.org"])
            wb.save(xp); wb.close()
            recs, issues = parse_input(xp)
            _assert(len(recs) == 1 and recs[0].data.get("Resource_Name") == "Sheet Alpha", "Excel ingestion/header recovery failed")

        progress_events: list[dict[str, Any]] = []
        outdir = t / "pipeline_out"
        summary = run_pipeline([array], outdir, network=False, workers=1, timeout=1, retries=0, cache_ttl=1, progress_callback=progress_events.append)
        _assert(summary.get("records_output") == 1, "pipeline smoke test failed")
        _assert((outdir / "run_manifest.json").exists(), "run manifest was not written")
        _assert(any(x.get("event") == "run_complete" for x in progress_events), "progress callback did not complete")

    # Endpoint extraction and normalization.
    _assert(split_urls("https://a.org; https://b.org/x") == ["https://a.org/", "https://b.org/x"], "multi-URL splitting failed")
    _assert(normalize_phone("1-800-532-5274") == "+1-800-532-5274", "phone normalization failed")
    _assert(normalize_phone("1-800-THE-HELP") == "+1-800-843-4357", "vanity phone normalization failed")
    _assert(split_emails("x@y.org; bad; Z@Example.COM") == ["x@y.org", "z@example.com"], "email extraction failed")
    false_phone = RawRecord({
        "Resource_Name": "Arizona Fathers Group", "Category": "X",
        "Phone": "+1-348-621-1024", "URL/Location": "N/A",
        "Description_Context": "Link: facebook.com/groups/348621102416402/",
    }, "x", 3, "test")
    fp = normalize_raw(false_phone)
    _assert(not fp.phones and "phone_matches_url_numeric_id_quarantined" in fp.flags,
            "numeric social URL ID was not quarantined from phone data")

    # Viability negation: 'no lease' must be positive and 'no congregate shelter' must not become a barrier.
    va = viability_assessment("No lease required; no congregate shelter; direct cash stabilization.", [])
    _assert(va["score"] > 50, "negation-safe viability scoring failed")
    _assert(not any(x["signal"] == "lease required" for x in va["barrier_signals"]), "negated lease was falsely treated as a barrier")

    # Strong dedupe vs ambiguous same-ish name.
    rr1 = RawRecord({"Resource_Name": "Alpha Center", "Category": "X", "URL/Location": "https://alpha.org", "Phone": "602-555-1212"}, "x", 0, "test")
    rr2 = RawRecord({"Resource_Name": "Alpha Center Program", "Category": "X", "URL/Location": "https://alpha.org/contact", "Phone": "N/A"}, "x", 1, "test")
    merged, _, _ = dedupe_records([normalize_raw(rr1), normalize_raw(rr2)])
    _assert(len(merged) == 1, "strong-identity dedupe failed")
    p1 = normalize_raw(RawRecord({"Resource_Name":"Youth Arts Grant", "Category":"X", "URL/Location":"https://agency.org/youth"}, "x", 4, "test"))
    p2 = normalize_raw(RawRecord({"Resource_Name":"Lifelong Arts Grant", "Category":"X", "URL/Location":"https://agency.org/lifelong"}, "x", 5, "test"))
    kept, _, _ = dedupe_records([p1, p2])
    _assert(len(kept) == 2, "shared agency host falsely merged distinct programs")
    i1 = normalize_raw(RawRecord({"Resource_Name":"Intake", "Category":"X", "URL/Location":"https://one.org/apply"}, "x", 6, "test"))
    i2 = normalize_raw(RawRecord({"Resource_Name":"Intake", "Category":"X", "URL/Location":"https://two.org/apply"}, "x", 7, "test"))
    kept, _, _ = dedupe_records([i1, i2])
    _assert(len(kept) == 2, "generic identical labels falsely merged across organizations")

    # Live local HTTP behavior verifies HEAD fallback, deep-link 404/root-live behavior, and contact discovery.
    class H(BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass
        def do_HEAD(self):
            if self.path == "/blocked-head":
                self.send_response(405); self.end_headers(); return
            if self.path == "/missing":
                self.send_response(404); self.end_headers(); return
            self.send_response(200); self.send_header("Content-Type", "text/html; charset=utf-8"); self.end_headers()
        def do_GET(self):
            if self.path == "/missing":
                self.send_response(404); self.send_header("Content-Type", "text/html"); self.end_headers(); self.wfile.write(b"<title>404 page not found</title>"); return
            if self.path == "/slow":
                time.sleep(3.0)
            self.send_response(200); self.send_header("Content-Type", "text/html; charset=utf-8"); self.end_headers()
            if self.path == "/contact":
                self.wfile.write(b'<html><head><title>Alpha Center Contact</title></head><body>123 Main Street, Phoenix, AZ 85001 Call 602-555-1212 <a href="mailto:jane@alpha.org">Jane Doe</a></body></html>')
            else:
                self.wfile.write(b'<html><head><title>Alpha Center | Help</title><meta property="og:site_name" content="Alpha Center"></head><body>Call 602-555-1212 <a href="mailto:help@alpha.org">Email</a> <a href="/contact">Contact</a></body></html>')

    class QuietThreadingHTTPServer(ThreadingHTTPServer):
        def handle_error(self, request, client_address):
            # Timeout tests intentionally disconnect a client before the test server writes.
            # BrokenPipe/connection-reset noise must not contaminate UI logs.
            return

    server = QuietThreadingHTTPServer(("127.0.0.1", 0), H)
    server.daemon_threads = True
    thread = threading.Thread(target=server.serve_forever, daemon=True); thread.start()
    port = server.server_address[1]
    try:
        # Local test bypasses normal_url's public-domain assumption by directly exercising http_attempt.
        a, body, headers = http_attempt(f"http://127.0.0.1:{port}/blocked-head", "HEAD", 2, False)
        _assert(a.status == 405, "HTTP 405 server-exists behavior failed")
        g, body, headers = http_attempt(f"http://127.0.0.1:{port}/blocked-head", "GET", 2, True)
        _assert(g.status == 200 and body, "GET fallback after blocked HEAD failed")
        parser, raw = parse_page(body, headers, g.final_url)
        emails, phones = discover_contacts(parser, raw)
        _assert("help@alpha.org" in emails, "official-page email discovery failed")
        _assert("+1-602-555-1212" in phones, "official-page phone discovery failed")
        ev = verify_url(f"http://127.0.0.1:{port}/", "Alpha Center", 2, 0, None)
        _assert(ev.website_status == "VERIFIED_REACHABLE", "full URL verifier failed on live local site")
        _assert("jane@alpha.org" in ev.discovered_emails, "contact-page follow-through failed")
        _assert(any("123 Main Street" in x for x in ev.discovered_addresses), "address discovery on contact page failed")
        _assert("Jane Doe" in ev.discovered_contact_names, "contact-name discovery on mailto anchor failed")
        moved = verify_url(f"http://127.0.0.1:{port}/missing", "Alpha Center", 2, 0, None)
        _assert(moved.website_status == "VERIFIED_REACHABLE", "dead deep-link incorrectly killed live root site")
        slow, _, _ = http_attempt(f"http://127.0.0.1:{port}/slow", "GET", 0.2, True)
        _assert(slow.elapsed_ms < 1800 and slow.outcome == "TRANSPORT_ERROR", "socket-level timeout was not bounded")
        # Force the raw worker itself to ignore timeouts so the outer hard guard is tested.
        original_raw = globals()["_http_attempt_raw"]
        def stalled_raw(*args, **kwargs):
            time.sleep(3.0)
            return original_raw(*args, **kwargs)
        globals()["_http_attempt_raw"] = stalled_raw
        try:
            guarded, _, _ = http_attempt(f"http://127.0.0.1:{port}/", "GET", 0.2, True)
            _assert(guarded.error_type == "HardTimeout" and guarded.elapsed_ms < 1800, "hard wall-clock HTTP timeout guard failed")
        finally:
            globals()["_http_attempt_raw"] = original_raw
    finally:
        server.shutdown(); server.server_close()

    print("SELF-TEST PASS: JSON/JSONL/CSV/TXT/Excel parser recovery, encoding/header detection, normalization, false-phone quarantine, conservative dedupe, pipeline manifest/progress hooks, negation logic, live/root fallback, contact-page discovery, and hard timeout guards.")


def expand_input_paths(items: list[str]) -> list[Path]:
    supported = SUPPORTED_EXTENSIONS
    out: list[Path] = []
    for item in items:
        p = Path(item).expanduser().resolve()
        if p.is_dir():
            out.extend(sorted(x for x in p.rglob("*") if x.is_file() and x.suffix.lower() in supported))
        else:
            out.append(p)
    # Stable unique paths.
    seen = set(); unique = []
    for p in out:
        sp = str(p)
        if sp not in seen:
            seen.add(sp); unique.append(p)
    return unique


def build_arg_parser() -> argparse.ArgumentParser:
    ap = argparse.ArgumentParser(description="Resilient multi-format organization/resource verifier")
    ap.add_argument("inputs", nargs="*", help="JSON/JSONL/NDJSON/CSV/TSV/TXT/MD/XLSX/XLSM input files")
    ap.add_argument("-o", "--output-dir", default="verification_output", help="Output directory")
    ap.add_argument("--no-network", action="store_true", help="Run structural/normalization audit without live network calls")
    ap.add_argument("--no-search-fallback", action="store_true", help="Disable public search discovery for records whose source website is missing/unusable")
    ap.add_argument("--workers", type=int, default=DEFAULT_WORKERS, help=f"Parallel record workers (default {DEFAULT_WORKERS})")
    ap.add_argument("--timeout", type=float, default=DEFAULT_TIMEOUT, help=f"Per network attempt timeout seconds (default {DEFAULT_TIMEOUT})")
    ap.add_argument("--retries", type=int, default=DEFAULT_RETRIES, help=f"GET retries per URL variant (default {DEFAULT_RETRIES})")
    ap.add_argument("--cache-ttl-hours", type=int, default=CACHE_TTL_HOURS, help="Reuse live endpoint evidence this many hours")
    ap.add_argument("--self-test", action="store_true", help="Run integrated tests and exit")
    ap.add_argument("--version", action="version", version=VERSION)
    return ap


def main(argv: Optional[list[str]] = None) -> int:
    ap = build_arg_parser()
    args = ap.parse_args(argv)
    if args.self_test:
        run_self_tests()
        return 0
    if not args.inputs:
        ap.error("at least one input file is required unless --self-test is used")
    if args.workers < 1 or args.workers > 64:
        ap.error("--workers must be between 1 and 64")
    if args.timeout < 1 or args.timeout > 120:
        ap.error("--timeout must be between 1 and 120 seconds")
    if args.retries < 0 or args.retries > 8:
        ap.error("--retries must be between 0 and 8")

    inputs = expand_input_paths(args.inputs)
    if not inputs:
        ap.error("no supported input files were found")
    output = Path(args.output_dir).expanduser().resolve()
    try:
        summary = run_pipeline(
            inputs=inputs, output_dir=output, network=not args.no_network,
            workers=args.workers, timeout=args.timeout, retries=args.retries,
            cache_ttl=args.cache_ttl_hours, search_fallback=not args.no_search_fallback,
        )
    except Exception as e:
        print(f"FATAL: {e.__class__.__name__}: {e}", file=sys.stderr)
        return 2
    print(json.dumps(summary, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
