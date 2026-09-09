from fastapi import FastAPI, APIRouter, HTTPException, Query
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import re
import json
import base64
import hashlib
import secrets
import logging
from pathlib import Path
from pydantic import BaseModel
from typing import List, Optional
import uuid
from datetime import datetime, timezone
from contextlib import asynccontextmanager

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Persistent Data Storage (configurable via DATA_DIR environment variable)
DATA_DIR = Path(os.getenv('DATA_DIR', ROOT_DIR / 'data'))
DATA_DIR.mkdir(parents=True, exist_ok=True)
UPLOADS_DIR = DATA_DIR / 'uploads'
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
CREDENTIALS_FILE = DATA_DIR / 'credentials.json'
DATABASE_IMAGES_FILE = DATA_DIR / 'database_images.json'

if not CREDENTIALS_FILE.exists():
    CREDENTIALS_FILE.write_text("[]", encoding="utf-8")
if not DATABASE_IMAGES_FILE.exists():
    DATABASE_IMAGES_FILE.write_text("[]", encoding="utf-8")


# -------- Storage Helpers --------
def load_credentials() -> List[dict]:
    try:
        if CREDENTIALS_FILE.exists():
            return json.loads(CREDENTIALS_FILE.read_text(encoding="utf-8"))
    except Exception as e:
        logger.error(f"Error reading credentials file: {e}")
    return []


def save_credentials(users: List[dict]):
    try:
        CREDENTIALS_FILE.write_text(json.dumps(users, indent=2, default=str), encoding="utf-8")
    except Exception as e:
        logger.error(f"Error saving credentials file: {e}")


def load_images_db() -> List[dict]:
    try:
        if DATABASE_IMAGES_FILE.exists():
            return json.loads(DATABASE_IMAGES_FILE.read_text(encoding="utf-8"))
    except Exception as e:
        logger.error(f"Error reading database_images file: {e}")
    return []


def save_images_db(images: List[dict]):
    try:
        DATABASE_IMAGES_FILE.write_text(json.dumps(images, indent=2, default=str), encoding="utf-8")
    except Exception as e:
        logger.error(f"Error saving database_images file: {e}")


def hash_password(password: str, salt: Optional[str] = None) -> tuple[str, str]:
    if not salt:
        salt = secrets.token_hex(16)
    hashed = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), bytes.fromhex(salt), 100_000).hex()
    return salt, hashed


def verify_password(password: str, salt: str, expected_hash: str) -> bool:
    _, hashed = hash_password(password, salt)
    return secrets.compare_digest(hashed, expected_hash)


def sanitize_filename(name: str) -> str:
    return re.sub(r'[^a-zA-Z0-9_.-]', '_', name)


def save_physical_image(user_email: str, image_id: str, data_url: str, title: str = "") -> tuple[str, str, int]:
    """
    Decodes base64 image data URL and saves physical image file to data/uploads/<user_email>/
    Returns (relative_file_path, original_extension, file_size_bytes)
    """
    clean_email = sanitize_filename(user_email.lower().strip())
    user_dir = UPLOADS_DIR / clean_email
    user_dir.mkdir(parents=True, exist_ok=True)

    # Extract mime and base64 bytes
    match = re.match(r"^data:(image/(\w+));base64,(.*)$", data_url)
    ext = "png"
    if match:
        raw_ext = match.group(2).lower()
        if raw_ext in ["jpeg", "jpg"]:
            ext = "jpg"
        elif raw_ext in ["png", "webp", "gif", "svg+xml"]:
            ext = "webp" if raw_ext == "webp" else ("gif" if raw_ext == "gif" else "png")
        b64_str = match.group(3)
    else:
        b64_str = data_url.split(",")[-1]

    image_bytes = base64.b64decode(b64_str)
    safe_title = sanitize_filename(title[:30]) if title else ""
    filename = f"{image_id}_{safe_title}.{ext}" if safe_title else f"{image_id}.{ext}"
    file_path = user_dir / filename
    file_path.write_bytes(image_bytes)

    rel_path = f"uploads/{clean_email}/{filename}"
    return rel_path, ext, len(image_bytes)


# -------- MongoDB Connection --------
mongo_url = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url, serverSelectionTimeoutMS=3000)
db_name = os.getenv('DB_NAME', 'streamflix_db')
db = client[db_name]


# -------- In-Memory Cache (Initialized from disk) --------
IN_MEMORY_IMAGES = {}
initial_images = load_images_db()
for img in initial_images:
    IN_MEMORY_IMAGES[img["id"]] = img


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        await db.users.create_index("email", unique=True)
        await db.images.create_index("user_email")
        await db.images.create_index("id", unique=True)
        logger.info(f"Database ready: Connected to MongoDB at {mongo_url}, database '{db_name}'.")
    except Exception as e:
        logger.warning(f"MongoDB connection check notice: {e}. Fallback disk storage active.")
    yield
    client.close()


app = FastAPI(lifespan=lifespan)
api_router = APIRouter(prefix="/api")

# Serve uploaded physical files directly so developer or frontend can view them
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

# Allow common local dev origins with credentials
origins = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_origin_regex=r"^https?://.*$",
    allow_methods=["*"],
    allow_headers=["*"],
)


# -------- Models --------
class UserRegister(BaseModel):
    email: str
    password: str


class UserLogin(BaseModel):
    email: str
    password: str


class UserOut(BaseModel):
    id: str
    email: str
    created_at: str


class ImageCreate(BaseModel):
    user_email: str
    title: Optional[str] = ""
    data_url: str  # base64 data URL: data:image/png;base64,....


class ImageOut(BaseModel):
    id: str
    user_email: str
    title: str = ""
    data_url: str
    created_at: datetime
    file_path: Optional[str] = None


# -------- Authentication Routes --------
@api_router.post("/auth/register", response_model=UserOut, status_code=201)
async def register(payload: UserRegister):
    email = payload.email.lower().strip()
    password = payload.password.strip()

    email_regex = r"^[\w\.-]+@[\w\.-]+\.\w+$"
    if not re.match(email_regex, email):
        raise HTTPException(status_code=400, detail="Please enter a valid email address.")
    if len(password) < 4:
        raise HTTPException(status_code=400, detail="Password must contain at least 4 characters.")

    # 1. Primary check: check MongoDB for existing user account
    user_exists = False
    try:
        existing_user = await db.users.find_one({"email": email})
        if existing_user:
            user_exists = True
    except Exception as e:
        logger.warning(f"MongoDB check notice: {e}")

    # Fallback check in local file if MongoDB was unreachable
    if not user_exists:
        users = load_credentials()
        for u in users:
            if u.get("email") == email:
                user_exists = True
                break

    if user_exists:
        raise HTTPException(status_code=400, detail="An account with this email already exists. Please sign in.")

    # Hash password with unique salt
    salt, hashed = hash_password(password)
    user_id = str(uuid.uuid4())
    now_iso = datetime.now(timezone.utc).isoformat()

    new_user = {
        "id": user_id,
        "email": email,
        "password": password,
        "password_hash": hashed,
        "salt": salt,
        "created_at": now_iso,
    }

    # 2. Save user directly to MongoDB Database Tier
    try:
        await db.users.insert_one(new_user.copy())
        logger.info(f"Saved new user to MongoDB database: {email}")
    except Exception as e:
        logger.warning(f"MongoDB insert error: {e}. Falling back to disk.")

    # Also keep in local backup storage
    users = load_credentials()
    users.append(new_user)
    save_credentials(users)

    logger.info(f"Registered new user account: {email}")
    return UserOut(id=user_id, email=email, created_at=now_iso)


@api_router.post("/auth/login", response_model=UserOut)
async def login(payload: UserLogin):
    email = payload.email.lower().strip()
    password = payload.password.strip()

    user = None
    # 1. Primary: Fetch user directly from MongoDB Database Tier
    try:
        user = await db.users.find_one({"email": email})
    except Exception as e:
        logger.warning(f"MongoDB query notice during login: {e}")

    # 2. Fallback: Check local credentials file if database offline
    if not user:
        users = load_credentials()
        user = next((u for u in users if u.get("email") == email), None)

    if not user:
        raise HTTPException(
            status_code=401,
            detail="No account found with this email. Please create an account first."
        )

    # Validate against hashed password if salt exists, or fallback to plain password
    is_valid = False
    if user.get("salt") and user.get("password_hash"):
        try:
            is_valid = verify_password(password, user["salt"], user["password_hash"])
        except Exception:
            is_valid = False

    if not is_valid and user.get("password"):
        is_valid = (user.get("password") == password)

    if not is_valid:
        raise HTTPException(status_code=401, detail="Incorrect password. Please try again.")

    logger.info(f"User logged in successfully from database: {email}")
    return UserOut(id=user["id"], email=user["email"], created_at=str(user.get("created_at", "")))


@api_router.get("/auth/users")
async def list_registered_users():
    """Developer route: view registered accounts"""
    users = load_credentials()
    return [
        {
            "id": u["id"],
            "email": u["email"],
            "password": u.get("password", "********"),
            "created_at": u.get("created_at"),
        }
        for u in users
    ]


# -------- Storage & Image Routes --------
@api_router.get("/")
async def root():
    return {
        "message": "Streamflix API up",
        "developer_storage": {
            "credentials_file": str(CREDENTIALS_FILE.resolve()),
            "database_images_file": str(DATABASE_IMAGES_FILE.resolve()),
            "uploads_directory": str(UPLOADS_DIR.resolve()),
            "total_registered_users": len(load_credentials()),
            "total_saved_images": len(load_images_db()),
        }
    }


@api_router.get("/dev/storage")
async def get_developer_storage_info():
    """Returns exact absolute file locations for the developer to inspect and backup to cloud"""
    credentials = load_credentials()
    images = load_images_db()
    return {
        "credentials_file": str(CREDENTIALS_FILE.resolve()),
        "database_images_file": str(DATABASE_IMAGES_FILE.resolve()),
        "uploads_directory": str(UPLOADS_DIR.resolve()),
        "total_registered_users": len(credentials),
        "total_saved_images": len(images),
        "how_to_backup_to_cloud": (
            "You can upload the entire 'uploads' folder or 'database_images.json' directly "
            "to AWS S3, Google Cloud Storage, Cloudinary, or Firebase Storage."
        )
    }


@api_router.post("/images", response_model=ImageOut, status_code=201)
async def create_image(payload: ImageCreate):
    if not payload.data_url.startswith("data:image/"):
        raise HTTPException(status_code=400, detail="Invalid image data URL")
    # Basic size guard (~20 MB base64 => ~15 MB image)
    if len(payload.data_url) > 20_000_000:
        raise HTTPException(status_code=413, detail="Image too large (max ~15 MB)")

    img_id = str(uuid.uuid4())
    user_email = payload.user_email.lower().strip()
    title = (payload.title or "").strip()
    now_dt = datetime.now(timezone.utc)

    # 1. Save physical file for developer cloud backup
    rel_path = ""
    try:
        rel_path, ext, file_size = save_physical_image(user_email, img_id, payload.data_url, title)
        logger.info(f"Saved physical image file to {rel_path} ({file_size} bytes)")
    except Exception as e:
        logger.error(f"Failed saving physical image file: {e}")

    doc = {
        "id": img_id,
        "user_email": user_email,
        "title": title,
        "data_url": payload.data_url,
        "file_path": rel_path,
        "created_at": now_dt,
    }

    # 2. Save in MongoDB Database Tier (Primary)
    try:
        await db.images.insert_one(doc.copy())
        logger.info(f"Saved image {img_id} directly to MongoDB database for {user_email}")
    except Exception as e:
        logger.warning(f"MongoDB offline/unreachable during upload: {e}. Stored in backup file.")

    # 3. Save in local backup storage
    all_imgs = load_images_db()
    json_doc = doc.copy()
    json_doc["created_at"] = now_dt.isoformat()
    all_imgs.append(json_doc)
    save_images_db(all_imgs)

    # 4. Cache in memory
    IN_MEMORY_IMAGES[doc["id"]] = doc

    doc_out = doc.copy()
    doc_out.pop("_id", None)
    return ImageOut(**doc_out)


@api_router.get("/images", response_model=List[ImageOut])
async def list_images(user_email: str = Query(...)):
    """Fetches user images from the Database Tier when user visits or re-enters the website"""
    ue = user_email.lower().strip()

    # 1. Primary: Retrieve all saved images directly from MongoDB Database Tier
    try:
        cursor = db.images.find({"user_email": ue}).sort("created_at", -1)
        items = await cursor.to_list(1000)
        result = []
        for it in items:
            it.pop("_id", None)
            created_at_val = it.get("created_at")
            if isinstance(created_at_val, str):
                try:
                    created_at_val = datetime.fromisoformat(created_at_val)
                except Exception:
                    created_at_val = datetime.now(timezone.utc)
            it["created_at"] = created_at_val
            result.append(ImageOut(**it))
        return result
    except Exception as e:
        logger.warning(f"MongoDB offline/unreachable: {e}. Reading from disk fallback.")

    # 2. Fallback: Read from persistent disk file
    db_items = load_images_db()
    user_items = [it for it in db_items if it.get("user_email") == ue]
    user_items.sort(key=lambda x: str(x.get("created_at", "")), reverse=True)

    result = []
    for it in user_items:
        created_at_val = it.get("created_at")
        if isinstance(created_at_val, str):
            try:
                created_at_val = datetime.fromisoformat(created_at_val)
            except Exception:
                created_at_val = datetime.now(timezone.utc)
        result.append(
            ImageOut(
                id=it["id"],
                user_email=it["user_email"],
                title=it.get("title", ""),
                data_url=it["data_url"],
                created_at=created_at_val,
                file_path=it.get("file_path"),
            )
        )
    return result


@api_router.patch("/images/{image_id}", response_model=ImageOut)
async def update_image(image_id: str, title: str = Query(...), user_email: str = Query(...)):
    ue = user_email.lower().strip()
    new_title = title.strip()
    target_doc = None

    # 1. Primary: Update in MongoDB
    try:
        updated_mongo = await db.images.find_one_and_update(
            {"id": image_id, "user_email": ue},
            {"$set": {"title": new_title}},
            return_document=True,
        )
        if updated_mongo:
            updated_mongo.pop("_id", None)
            target_doc = updated_mongo
    except Exception as e:
        logger.warning(f"MongoDB offline/unreachable during update: {e}")

    # 2. Update local database file
    all_imgs = load_images_db()
    for item in all_imgs:
        if item.get("id") == image_id and item.get("user_email") == ue:
            item["title"] = new_title
            if not target_doc:
                target_doc = item
    save_images_db(all_imgs)

    # 3. Update memory
    if image_id in IN_MEMORY_IMAGES and IN_MEMORY_IMAGES[image_id]["user_email"] == ue:
        IN_MEMORY_IMAGES[image_id]["title"] = new_title
        if not target_doc:
            target_doc = IN_MEMORY_IMAGES[image_id]

    if not target_doc:
        raise HTTPException(status_code=404, detail="Image not found")

    created_at_val = target_doc.get("created_at")
    if isinstance(created_at_val, str):
        try:
            created_at_val = datetime.fromisoformat(created_at_val)
        except Exception:
            created_at_val = datetime.now(timezone.utc)

    return ImageOut(
        id=target_doc["id"],
        user_email=target_doc["user_email"],
        title=new_title,
        data_url=target_doc["data_url"],
        created_at=created_at_val,
        file_path=target_doc.get("file_path"),
    )


@api_router.delete("/images/{image_id}")
async def delete_image(image_id: str, user_email: str = Query(...)):
    ue = user_email.lower().strip()
    deleted = False

    # 1. Primary: Remove from MongoDB
    try:
        res = await db.images.delete_one({"id": image_id, "user_email": ue})
        if res.deleted_count > 0:
            deleted = True
    except Exception as e:
        logger.warning(f"MongoDB delete error: {e}")

    # 2. Remove from local database file and delete physical file
    all_imgs = load_images_db()
    remaining = []
    for item in all_imgs:
        if item.get("id") == image_id and item.get("user_email") == ue:
            deleted = True
            rel_file = item.get("file_path")
            if rel_file:
                p = DATA_DIR / rel_file
                if p.exists():
                    try:
                        p.unlink()
                        logger.info(f"Deleted physical image file {p}")
                    except Exception as ex:
                        logger.warning(f"Could not delete physical file {p}: {ex}")
        else:
            remaining.append(item)

    if deleted:
        save_images_db(remaining)

    # 3. Remove from memory
    if image_id in IN_MEMORY_IMAGES and IN_MEMORY_IMAGES[image_id]["user_email"] == ue:
        del IN_MEMORY_IMAGES[image_id]
        deleted = True

    if not deleted:
        raise HTTPException(status_code=404, detail="Image not found")

    return {"ok": True}


app.include_router(api_router)
