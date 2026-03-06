# app/main.py
from __future__ import annotations

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import rpc, rpg


app = FastAPI(
    title="MineBackfill API",
    version="0.1.0",
    description="API pour le dimensionnement des mélanges de remblais cimentés (RPC, RPG, RRC).",
)

# ----------------------------------------------------------------------
# CORS: allow frontend (Next.js) to call the API from http://localhost:3000
# ----------------------------------------------------------------------
origins_env = os.getenv("CORS_ALLOW_ORIGINS", "").strip()
if origins_env:
    origins = [o.strip() for o in origins_env.split(",") if o.strip()]
else:
    origins = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "https://frontend-eight-xi-64.vercel.app",
    ]

allow_all_origins = "*" in origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=not allow_all_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ----------------------------------------------------------------------
# Routers
# ----------------------------------------------------------------------
app.include_router(rpc.router)
app.include_router(rpg.router)


# ----------------------------------------------------------------------
# Simple health endpoint
# ----------------------------------------------------------------------
@app.get("/")
def read_root():
    return {"status": "ok", "message": "MineBackfill API running"}
