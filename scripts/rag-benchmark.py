#!/usr/bin/env python3
"""
RAG Benchmark - Self-contained
Generates chunks from PDFs, creates embeddings, does vector search locally.
No dependency on the backend.
"""

import subprocess
import json
import time
import signal
import os
import sys
import sqlite3
import struct
import math
import hashlib

MODELS_DIR = os.path.expanduser("~/Documents/llm/models")
DB_PATH = os.path.expanduser("~/.code-llm/vectors.db")
COLLECTION_ID = 15
EMBEDDING_PORT = 8082

EMBEDDING_MODELS = [
    ("nomic-embed-text-v1.5.Q4_K_M.gguf", "nomic-embed-v1.5"),
    ("llama-3.2-3b-q4.gguf", "llama-3.2-3b"),
    ("qwen3-8b-q4_k_m.gguf", "qwen3-8b"),
    ("phi-4-Q4_K_M.gguf", "phi-4-14b"),
]

QUERIES = [
    ("o que é Output Structuring?", "Guia"),
    ("Chain of Thought", "Guia"),
    ("Guia Definitivo de Engenharia de Prompt", "Guia"),
    ("plano de ação IA BBTS", "Plano"),
    ("contrato Intevia", "CTR-"),
    ("ambiente de homologação testes cenários", "IPT"),
    ("como formatar saída de IA?", "Guia"),
    ("técnicas de prompt engineering", "Guia"),
    ("Few-Shot prompting", "Guia"),
    ("SMS plataforma digital", "CTR-"),
]

MIN_SCORES = [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5]
TOP_KS = [3, 5, 10, 20, 50]

embedding_proc = None


def kill_port(port):
    try:
        pids = subprocess.check_output(f"lsof -ti :{port}", shell=True, text=True).strip()
        for p in pids.split("\n"):
            if p:
                os.kill(int(p), signal.SIGKILL)
        time.sleep(1)
    except Exception:
        pass


def start_server(model_file):
    global embedding_proc
    if embedding_proc:
        embedding_proc.kill()
        embedding_proc.wait()
        embedding_proc = None
    kill_port(EMBEDDING_PORT)
    time.sleep(1)
    model_path = os.path.join(MODELS_DIR, model_file)
    if not os.path.exists(model_path):
        return False
    embedding_proc = subprocess.Popen(
        [
            "llama-server", "-m", model_path,
            "--port", str(EMBEDDING_PORT),
            "--embeddings", "--pooling", "mean",
            "-c", "2048", "--ubatch-size", "2048", "--batch-size", "2048",
        ],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    for _ in range(120):
        try:
            r = subprocess.run(
                ["curl", "-s", f"http://localhost:{EMBEDDING_PORT}/health"],
                capture_output=True, text=True, timeout=2,
            )
            if r.returncode == 0 and "ok" in r.stdout:
                return True
        except Exception:
            pass
        time.sleep(1)
    return False


MAX_CHARS = 3500

def get_embedding(text):
    truncated = text[:MAX_CHARS] if len(text) > MAX_CHARS else text
    r = subprocess.run(
        ["curl", "-s", f"http://localhost:{EMBEDDING_PORT}/embedding",
         "-H", "Content-Type: application/json",
         "-d", json.dumps({"content": truncated})],
        capture_output=True, text=True, timeout=30,
    )
    d = json.loads(r.stdout)
    if "error" in str(d):
        raise RuntimeError(f"Embedding error: {d}")
    emb = d[0]["embedding"] if isinstance(d, list) else d["embedding"]
    return emb[0] if isinstance(emb[0], list) else emb


def cosine(a, b):
    if len(a) != len(b):
        return 0
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(x * x for x in b))
    return dot / (na * nb) if na * nb > 0 else 0


def float32_buf(arr):
    return struct.pack(f"<{len(arr)}f", *arr)


def buf_float32(buf):
    n = len(buf) // 4
    return list(struct.unpack(f"<{n}f", buf))


def quality_check():
    try:
        e1 = get_embedding("hello world")
        e2 = get_embedding("Python é uma linguagem de programação")
        sim = cosine(e1, e2)
        dims = len(e1)
        ok = sim < 0.95
        print(f"  Quality: dims={dims} sim={sim:.4f} {'GOOD' if ok else 'BAD'}")
        return ok, dims
    except Exception as e:
        print(f"  Quality check failed: {e}")
        return False, 0


def reindex():
    """Re-embed all existing chunks"""
    db = sqlite3.connect(DB_PATH)
    chunks = db.execute("SELECT id, code, summary FROM code_chunks").fetchall()
    if not chunks:
        db.close()
        return 0
    db.execute("DELETE FROM vectors")
    db.commit()
    count = 0
    for cid, code, summary in chunks:
        text = f"{summary}\n\n{code}" if summary else (code or "")
        if not text.strip():
            continue
        try:
            emb = get_embedding(text)
            db.execute("INSERT INTO vectors (chunk_id, embedding) VALUES (?, ?)", (cid, float32_buf(emb)))
            count += 1
            if count % 5 == 0:
                db.commit()
                sys.stdout.write(f"\r    {count}/{len(chunks)}")
                sys.stdout.flush()
        except Exception as e:
            print(f"\n    Error chunk {cid}: {e}")
    db.commit()
    db.close()
    print(f"\r    Done: {count}/{len(chunks)} vectors" + " " * 20)
    return count


def search(query_emb, min_score, top_k):
    db = sqlite3.connect(DB_PATH)
    rows = db.execute("""
        SELECT c.file_path, v.embedding
        FROM code_chunks c
        JOIN vectors v ON v.chunk_id = c.id
        JOIN collection_files cf ON cf.repo = c.repo AND cf.file_path = c.file_path
        WHERE cf.collection_id = ?
    """, (COLLECTION_ID,)).fetchall()
    db.close()
    scored = []
    for fp, buf in rows:
        emb = buf_float32(buf)
        s = cosine(query_emb, emb)
        if min_score == 0 or s >= min_score:
            scored.append((fp, s))
    scored.sort(key=lambda x: -x[1])
    return scored[:top_k]


def main():
    all_results = []
    print("=" * 100)
    print("RAG BENCHMARK")
    print(f"Models: {len(EMBEDDING_MODELS)} | Queries: {len(QUERIES)} | Combos: {len(MIN_SCORES)*len(TOP_KS)}")
    print("=" * 100)

    # Check chunks exist
    db = sqlite3.connect(DB_PATH)
    chunk_count = db.execute("SELECT count(*) FROM code_chunks").fetchone()[0]
    db.close()
    if chunk_count == 0:
        print("ERROR: No chunks in DB. Start the app, add files to collection, and let it index first.")
        print("Then re-run this benchmark.")
        sys.exit(1)
    print(f"Found {chunk_count} chunks in DB\n")

    for model_file, model_name in EMBEDDING_MODELS:
        print(f"\n{'='*80}")
        print(f"MODEL: {model_name} ({model_file})")
        print(f"{'='*80}")

        print(f"  Starting server...")
        if not start_server(model_file):
            print(f"  SKIP: server failed")
            continue

        ok, dims = quality_check()
        if not ok:
            print(f"  SKIP: bad quality")
            continue

        print(f"  Reindexing...")
        n = reindex()
        if n == 0:
            print(f"  SKIP: no vectors")
            continue

        # Pre-compute query embeddings
        print(f"  Computing query embeddings...")
        query_embs = {}
        for q, _ in QUERIES:
            try:
                query_embs[q] = get_embedding(q)
            except Exception as e:
                print(f"    Failed: {q[:30]}... {e}")

        print(f"  Running {len(MIN_SCORES)*len(TOP_KS)} param combos × {len(QUERIES)} queries...")
        for ms in MIN_SCORES:
            for tk in TOP_KS:
                hits = 0
                details = []
                for q, expected in QUERIES:
                    if q not in query_embs:
                        details.append({"q": q[:35], "exp": expected, "hit": False, "top": "ERR", "score": 0, "n": 0})
                        continue
                    results = search(query_embs[q], ms, tk)
                    found = any(expected in fp for fp, _ in results)
                    top_file = results[0][0].split("/")[-1][:35] if results else "NONE"
                    top_score = results[0][1] if results else 0
                    if found:
                        hits += 1
                    details.append({"q": q[:35], "exp": expected, "hit": found, "top": top_file, "score": round(top_score, 4), "n": len(results)})

                acc = hits / len(QUERIES) * 100
                all_results.append({
                    "model": model_name, "dims": dims,
                    "min_score": ms, "top_k": tk,
                    "accuracy": acc, "hits": hits, "total": len(QUERIES),
                    "details": details,
                })
                tag = " ***" if acc == 100 else (" <<" if acc >= 80 else "")
                print(f"    ms={ms:.2f} tk={tk:>2} | {hits:>2}/{len(QUERIES)} ({acc:5.1f}%){tag}")

    if embedding_proc:
        embedding_proc.kill()

    # Sort
    all_results.sort(key=lambda r: (-r["accuracy"], r["min_score"], r["top_k"]))

    # Final table
    print("\n\n" + "=" * 110)
    print("TOP 40 CONFIGURATIONS RANKED BY ACCURACY")
    print("=" * 110)
    print(f"{'#':>3} | {'Model':<20} | {'Dims':>5} | {'minScore':>8} | {'topK':>4} | {'Hits':>6} | {'Accuracy':>8}")
    print("-" * 110)
    for i, r in enumerate(all_results[:40], 1):
        print(f"{i:>3} | {r['model']:<20} | {r['dims']:>5} | {r['min_score']:>8.2f} | {r['top_k']:>4} | {r['hits']:>2}/{r['total']:<3} | {r['accuracy']:>7.1f}%")

    if all_results:
        best = all_results[0]
        print(f"\n{'='*80}")
        print(f"BEST: {best['model']} | minScore={best['min_score']} | topK={best['top_k']} | {best['accuracy']:.0f}%")
        print(f"{'='*80}")
        for d in best["details"]:
            s = "HIT " if d["hit"] else "MISS"
            print(f"  [{s}] {d['q']:<37} exp={d['exp']:<8} got={d['top']:<35} ({d['score']:.4f}) n={d['n']}")

    out = os.path.join(os.path.dirname(__file__), "rag-benchmark-results.json")
    with open(out, "w") as f:
        json.dump(all_results, f, indent=2, ensure_ascii=False)
    print(f"\nSaved to {out}")
    os.system("afplay /System/Library/Sounds/Glass.aiff &")


if __name__ == "__main__":
    main()
