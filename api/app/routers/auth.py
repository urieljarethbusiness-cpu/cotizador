from fastapi import APIRouter, Depends, HTTPException, status

from app.database import get_pool
from app.auth import verify_password, create_access_token, require_auth, get_password_hash
from app.models.common import LoginRequest, LoginResponse, OkResponse, ErrorResponse

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/login", response_model=LoginResponse)
async def login(body: LoginRequest):
    pool = get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            'SELECT id, email, password, name, role FROM "User" WHERE email = $1',
            body.email,
        )

    if not row:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales inválidas",
        )

    if not verify_password(body.password, row["password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales inválidas",
        )

    token = create_access_token({"sub": str(row["id"]), "email": row["email"], "role": row["role"]})

    return LoginResponse(
        access_token=token,
        user={
            "id": row["id"],
            "email": row["email"],
            "name": row["name"],
            "role": row["role"],
        },
    )


@router.post("/logout", response_model=OkResponse)
async def logout():
    return OkResponse(ok=True)


@router.get("/me")
async def me(current_user: dict = Depends(require_auth)):
    pool = get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            'SELECT id, email, name, role, "createdAt", "updatedAt" FROM "User" WHERE id = $1',
            current_user["sub"],
        )

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado",
        )

    return {
        "id": row["id"],
        "email": row["email"],
        "name": row["name"],
        "role": row["role"],
        "createdAt": row["createdAt"].isoformat() if row["createdAt"] else None,
        "updatedAt": row["updatedAt"].isoformat() if row["updatedAt"] else None,
    }
