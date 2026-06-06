#!/usr/bin/env python
"""Reads JSON [{name, src}, ...] from stdin, ast.parse()s each src, and prints
JSON {name: null|error}. Used by codegen-python-validity.test.js to assert the
generated Manim scripts are syntactically valid Python (a render-blocking class
that string-match codegen tests can't catch)."""
import sys, json, ast

items = json.load(sys.stdin)
out = {}
for it in items:
    try:
        ast.parse(it["src"])
        out[it["name"]] = None
    except SyntaxError as e:
        out[it["name"]] = f"{e.msg} (line {e.lineno}): {(e.text or '').strip()}"
print(json.dumps(out))
