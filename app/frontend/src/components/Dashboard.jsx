import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Upload,
  Trash2,
  LogOut,
  Image as ImageIcon,
  Loader2,
  X,
  Pencil,
  Check,
  Cloud,
  Database,
  FolderArchive,
  KeyRound,
  Copy,
  ExternalLink,
  ShieldCheck,
  HardDrive
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import {
  listImages,
  uploadImage,
  deleteImage,
  updateImageTitle,
  readFileAsDataURL,
  getDevStorageInfo,
} from "../lib/api";

const Dashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(null); // { data_url, title }
  const [editingId, setEditingId] = useState(null);
  const [editingText, setEditingText] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [devModalOpen, setDevModalOpen] = useState(false);
  const [devStorage, setDevStorage] = useState(null);
  const [copiedKey, setCopiedKey] = useState("");

  const copyToClipboard = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(""), 2000);
  };

  const loadStorageInfo = async () => {
    try {
      const info = await getDevStorageInfo();
      setDevStorage(info);
    } catch (e) {
      console.warn("Could not load developer storage info:", e);
    }
  };

  const load = async () => {
    try {
      setLoading(true);
      const data = await listImages(user.email);
      setImages(data);
    } catch (e) {
      setError("Failed to load images");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    loadStorageInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFiles = async (files) => {
    setError("");
    const arr = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (arr.length === 0) {
      setError("Please choose image files only.");
      return;
    }
    setUploading(true);
    try {
      const newOnes = [];
      for (const f of arr) {
        if (f.size > 10 * 1024 * 1024) {
          setError(`"${f.name}" is larger than 10 MB and was skipped.`);
          continue;
        }
        const dataUrl = await readFileAsDataURL(f);
        try {
          const created = await uploadImage(user.email, dataUrl, f.name);
          newOnes.push(created);
        } catch (err) {
          console.error("Upload error for", f.name, err);
          const msg =
            err?.response?.data?.detail ||
            err?.message ||
            "Upload failed. Please try again.";
          setError(`"${f.name}": ${msg}`);
        }
      }
      if (newOnes.length) setImages((prev) => [...newOnes, ...prev]);
    } catch (e) {
      console.error("Upload flow failed:", e);
      setError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const onFileChange = (e) => {
    if (e.target.files?.length) handleFiles(e.target.files);
    e.target.value = "";
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this image?")) return;
    try {
      await deleteImage(user.email, id);
      setImages((prev) => prev.filter((i) => i.id !== id));
    } catch {
      setError("Could not delete image.");
    }
  };

  const saveTitle = async (id) => {
    try {
      const updated = await updateImageTitle(user.email, id, editingText);
      setImages((prev) => prev.map((i) => (i.id === id ? updated : i)));
    } catch {
      setError("Could not update title.");
    } finally {
      setEditingId(null);
      setEditingText("");
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const initial = (user?.email || "?").charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-[#141414] text-white font-netflix">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-gradient-to-b from-black/95 to-black/70 backdrop-blur-sm border-b border-white/5">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-8 py-4">
          <div className="flex items-center gap-8">
            <span
              className="text-[#E50914] font-black select-none"
              style={{ fontSize: "1.75rem", letterSpacing: "0.02em" }}
            >
              ALPHA
            </span>
            <nav className="hidden md:flex gap-6 text-sm text-[#e5e5e5]">
              <a href="#" className="text-white font-medium">
                My Gallery
              </a>
              <a href="#" className="hover:text-white text-[#b3b3b3]">
                Recently Added
              </a>
              <a href="#" className="hover:text-white text-[#b3b3b3]">
                Favorites
              </a>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                loadStorageInfo();
                setDevModalOpen(true);
              }}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 text-xs text-white transition-all cursor-pointer shadow-sm hover:border-[#E50914]"
              title="View where pictures and credentials files are stored for developer cloud backups"
            >
              <HardDrive className="w-3.5 h-3.5 text-[#E50914]" />
              <span className="font-medium">Developer Storage & Cloud Backup</span>
            </button>

            <div className="relative">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-2 group cursor-pointer"
              >
                <div className="w-9 h-9 rounded bg-gradient-to-br from-[#E50914] to-[#7a0610] flex items-center justify-center font-bold text-sm">
                  {initial}
                </div>
                <span className="hidden sm:block text-sm text-[#b3b3b3] group-hover:text-white transition-colors">
                  {user?.email}
                </span>
              </button>
              {menuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-black/95 border border-white/10 rounded-md shadow-xl overflow-hidden z-50">
                  <div className="px-4 py-3 text-xs text-[#b3b3b3] border-b border-white/5">
                    Signed in as
                    <div className="text-white text-sm mt-1 truncate">
                      {user?.email}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      setDevModalOpen(true);
                    }}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-white hover:bg-white/10 transition-colors cursor-pointer border-b border-white/5"
                  >
                    <HardDrive className="w-3.5 h-3.5 text-[#E50914]" />
                    Developer Storage Paths
                  </button>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-4 py-3 text-sm text-white hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign out of Alpha
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Hero + Uploader */}
      <section className="relative">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-30"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1611087968157-41fa023f8608?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2OTF8MHwxfHNlYXJjaHwzfHxtb3ZpZSUyMHBvc3RlcnN8ZW58MHx8fGJsYWNrfDE3ODg2NDcwMDJ8MA&ixlib=rb-4.1.0&q=85')",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/40 to-[#141414]" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-8 pt-10 pb-14">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-2">
            My Gallery
          </h1>
          <p className="text-[#b3b3b3] mb-2 max-w-2xl">
            Upload your pictures and keep them safe online. Drag and drop
            straight from your desktop or click below to choose files.
          </p>
          <p className="text-xs text-[#8c8c8c] mb-6">
            Private folder:{" "}
            <span className="text-[#E50914] font-mono">
              /users/{user?.email}
            </span>{" "}
            · only you can see these pictures
          </p>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`cursor-pointer rounded-lg border-2 border-dashed p-8 md:p-10 text-center transition-colors ${
              dragActive
                ? "border-[#E50914] bg-[#E50914]/10"
                : "border-white/20 hover:border-white/40 bg-black/40"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={onFileChange}
            />
            <div className="flex flex-col items-center gap-3">
              {uploading ? (
                <Loader2 className="w-10 h-10 text-[#E50914] animate-spin" />
              ) : (
                <div className="w-14 h-14 rounded-full bg-[#E50914]/20 flex items-center justify-center">
                  <Upload className="w-7 h-7 text-[#E50914]" />
                </div>
              )}
              <div className="text-lg font-medium">
                {uploading
                  ? "Uploading..."
                  : dragActive
                  ? "Drop your images here"
                  : "Drag & drop images here, or click to browse"}
              </div>
              <div className="text-xs text-[#8c8c8c]">
                PNG, JPG, GIF, WebP · up to 10 MB each · multiple files allowed
              </div>
            </div>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-[#e87c03]/90 rounded-sm text-white text-sm">
              {error}
            </div>
          )}
        </div>
      </section>

      {/* Gallery */}
      <section className="max-w-7xl mx-auto px-4 sm:px-8 pb-24">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-[#E50914]" />
            Your Pictures
            <span className="text-[#8c8c8c] text-sm font-normal ml-2">
              ({images.length})
            </span>
          </h2>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="aspect-[3/4] bg-[#222] animate-pulse rounded-md"
              />
            ))}
          </div>
        ) : images.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-white/10 rounded-lg">
            <ImageIcon className="w-12 h-12 text-[#333] mx-auto mb-3" />
            <p className="text-[#b3b3b3]">
              No pictures yet. Upload your first one above!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {images.map((img) => (
              <div
                key={img.id}
                className="group relative aspect-[3/4] rounded-md overflow-hidden bg-[#222] shadow-lg hover:shadow-2xl hover:scale-[1.03] transition-all duration-200"
              >
                <img
                  src={img.data_url}
                  alt={img.title || "uploaded"}
                  className="w-full h-full object-cover cursor-pointer"
                  onClick={() => setPreview(img)}
                />

                {/* Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

                {/* Delete */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(img.id);
                  }}
                  className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/70 hover:bg-[#E50914] text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer z-10"
                  aria-label="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>

                {/* Title */}
                <div className="absolute bottom-0 left-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  {editingId === img.id ? (
                    <div className="flex gap-1">
                      <input
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="flex-1 min-w-0 bg-black/80 border border-white/20 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-[#E50914]"
                        autoFocus
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          saveTitle(img.id);
                        }}
                        className="p-1.5 rounded bg-[#E50914] hover:bg-[#f6121d] cursor-pointer"
                      >
                        <Check className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-white truncate">
                        {img.title || "Untitled"}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingId(img.id);
                          setEditingText(img.title || "");
                        }}
                        className="p-1 rounded hover:bg-white/10 cursor-pointer"
                        aria-label="Rename"
                      >
                        <Pencil className="w-3 h-3 text-[#b3b3b3]" />
                      </button>
                    </div>
                  )}
                  {img.file_path && (
                    <div className="mt-1 flex items-center gap-1 text-[10px] text-zinc-400 font-mono truncate" title={`Physical copy: ${img.file_path}`}>
                      <HardDrive className="w-2.5 h-2.5 text-[#E50914] shrink-0" />
                      <span className="truncate">{img.file_path}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Preview modal */}
      {preview && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setPreview(null)}
        >
          <button
            onClick={() => setPreview(null)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
          <div
            className="max-w-5xl max-h-[85vh] w-full flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={preview.data_url}
              alt={preview.title}
              className="max-w-full max-h-[80vh] object-contain rounded shadow-2xl"
            />
            {preview.title && (
              <div className="mt-3 text-sm text-[#b3b3b3]">{preview.title}</div>
            )}
            {preview.file_path && (
              <div className="mt-1 text-xs text-zinc-400 font-mono bg-black/60 px-3 py-1 rounded border border-white/10">
                Server file: {preview.file_path}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Developer Cloud Storage & Database Modal */}
      {devModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setDevModalOpen(false)}
        >
          <div
            className="bg-[#181818] border border-white/15 rounded-xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl overflow-y-auto max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#E50914]/20 border border-[#E50914]/40 flex items-center justify-center text-[#E50914]">
                  <HardDrive className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Developer Database & Cloud Storage</h2>
                  <p className="text-xs text-zinc-400">Exact disk paths to your credentials and picture files</p>
                </div>
              </div>
              <button
                onClick={() => setDevModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-zinc-300 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 gap-3 my-5">
              <div className="bg-black/50 border border-white/10 rounded-lg p-3">
                <div className="text-xs text-zinc-400">Total Registered Users</div>
                <div className="text-2xl font-bold text-white mt-1">
                  {devStorage?.total_registered_users ?? "..."}
                </div>
                <div className="text-[11px] text-emerald-400 mt-0.5">Stored in credentials file</div>
              </div>
              <div className="bg-black/50 border border-white/10 rounded-lg p-3">
                <div className="text-xs text-zinc-400">Total Pictures Backed Up</div>
                <div className="text-2xl font-bold text-white mt-1">
                  {devStorage?.total_saved_images ?? images.length}
                </div>
                <div className="text-[11px] text-sky-400 mt-0.5">Ready for cloud upload</div>
              </div>
            </div>

            {/* Storage Locations */}
            <div className="space-y-4 text-left">
              {/* Credentials File */}
              <div className="bg-[#202020] border border-white/10 rounded-lg p-4">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-zinc-200 flex items-center gap-2">
                    <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                    1. Login Credentials File (All Accounts)
                  </span>
                  <button
                    onClick={() => copyToClipboard(devStorage?.credentials_file || "app/backend/data/credentials.json", "cred")}
                    className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 cursor-pointer bg-white/5 hover:bg-white/10 px-2 py-0.5 rounded"
                  >
                    <Copy className="w-3 h-3" />
                    {copiedKey === "cred" ? "Copied!" : "Copy Path"}
                  </button>
                </div>
                <code className="block bg-black/60 text-amber-200 text-xs p-2.5 rounded font-mono break-all border border-white/5">
                  {devStorage?.credentials_file || "app/backend/data/credentials.json"}
                </code>
                <p className="text-[11px] text-zinc-400 mt-1.5 leading-normal">
                  All user accounts, emails, passwords, and IDs are saved here on registration so any client can log in smoothly.
                </p>
              </div>

              {/* Database Images JSON */}
              <div className="bg-[#202020] border border-white/10 rounded-lg p-4">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-zinc-200 flex items-center gap-2">
                    <Database className="w-3.5 h-3.5 text-sky-400" />
                    2. Picture Database File (Metadata & Base64 Copy)
                  </span>
                  <button
                    onClick={() => copyToClipboard(devStorage?.database_images_file || "app/backend/data/database_images.json", "db_img")}
                    className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 cursor-pointer bg-white/5 hover:bg-white/10 px-2 py-0.5 rounded"
                  >
                    <Copy className="w-3 h-3" />
                    {copiedKey === "db_img" ? "Copied!" : "Copy Path"}
                  </button>
                </div>
                <code className="block bg-black/60 text-sky-200 text-xs p-2.5 rounded font-mono break-all border border-white/5">
                  {devStorage?.database_images_file || "app/backend/data/database_images.json"}
                </code>
                <p className="text-[11px] text-zinc-400 mt-1.5 leading-normal">
                  Persistent developer JSON database file recording each uploaded picture, title, timestamp, and client email.
                </p>
              </div>

              {/* Physical Uploads Directory */}
              <div className="bg-[#202020] border border-[#E50914]/30 rounded-lg p-4 bg-gradient-to-r from-[#202020] to-[#2a1315]">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-white flex items-center gap-2">
                    <FolderArchive className="w-3.5 h-3.5 text-[#E50914]" />
                    3. Physical Pictures Directory (For Cloud Upload)
                  </span>
                  <button
                    onClick={() => copyToClipboard(devStorage?.uploads_directory || "app/backend/data/uploads", "uploads")}
                    className="text-xs text-zinc-300 hover:text-white flex items-center gap-1 cursor-pointer bg-white/10 hover:bg-white/20 px-2 py-0.5 rounded"
                  >
                    <Copy className="w-3 h-3" />
                    {copiedKey === "uploads" ? "Copied!" : "Copy Path"}
                  </button>
                </div>
                <code className="block bg-black/70 text-emerald-300 text-xs p-2.5 rounded font-mono break-all border border-emerald-500/20">
                  {devStorage?.uploads_directory || "app/backend/data/uploads"}
                </code>
                <p className="text-[11px] text-zinc-300 mt-1.5 leading-normal">
                  Decoded physical image files (<code className="text-white">.png</code>, <code className="text-white">.jpg</code>) stored in subfolders by client email. You can directly copy this entire directory to your cloud storage!
                </p>
              </div>
            </div>

            {/* Cloud Upload Guide */}
            <div className="mt-5 p-4 rounded-lg bg-black/40 border border-white/10 text-left">
              <div className="text-xs font-semibold text-zinc-300 mb-2 flex items-center gap-1.5">
                <Cloud className="w-4 h-4 text-sky-400" />
                How to upload to your Cloud (AWS S3, Google Cloud, Cloudinary)
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed mb-2">
                Whenever users upload pictures on the site, an extra copy is automatically saved inside the <code className="text-zinc-200">uploads/</code> folder. To sync to your cloud:
              </p>
              <div className="space-y-1.5 text-[11px] font-mono">
                <div className="bg-black/70 p-2 rounded text-zinc-300 border border-white/5">
                  <span className="text-zinc-500"># AWS S3 sync:</span><br />
                  aws s3 sync "{devStorage?.uploads_directory || "app/backend/data/uploads"}" s3://your-bucket-name/uploads/
                </div>
                <div className="bg-black/70 p-2 rounded text-zinc-300 border border-white/5">
                  <span className="text-zinc-500"># Google Cloud Storage:</span><br />
                  gsutil -m rsync -r "{devStorage?.uploads_directory || "app/backend/data/uploads"}" gs://your-bucket-name/uploads/
                </div>
              </div>
            </div>

            <div className="mt-6 text-right">
              <button
                onClick={() => setDevModalOpen(false)}
                className="px-5 py-2 rounded bg-[#E50914] hover:bg-[#f6121d] text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                Close Window
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
