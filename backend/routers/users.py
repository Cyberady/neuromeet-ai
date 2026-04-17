from fastapi import APIRouter, Request, HTTPException
import httpx, os

router = APIRouter()
BETTER_AUTH_URL = os.getenv("BETTER_AUTH_URL")

async def get_current_user(request: Request) -> dict:
    """Validate session with Better Auth and return user."""
    cookie = request.headers.get("cookie", "")
    auth_header = request.headers.get("authorization", "")

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{BETTER_AUTH_URL}/api/auth/get-session",
            headers={
                "cookie": cookie,
                "authorization": auth_header,
            }
        )

    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Unauthorized")

    data = resp.json()
    if not data or not data.get("user"):
        raise HTTPException(status_code=401, detail="Not authenticated")

    return data["user"]

@router.get("/me")
async def get_me(request: Request):
    user = await get_current_user(request)
    return {
        "id":    user.get("id"),
        "name":  user.get("name"),
        "email": user.get("email"),
        "image": user.get("image"),
    }