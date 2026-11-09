import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { storage } from "./firebase";
/** Validates and uploads an image, returning its download URL. Throws a user-friendly Error. */
export async function uploadImage(path: string, file: File): Promise<string> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 5 * 1024 * 1024) throw new Error("Choose a JPG, PNG or WebP photo under 5 MB.");
  try { const r = ref(storage, path); await uploadBytes(r, file, { contentType: file.type }); return await getDownloadURL(r); } catch { throw new Error("The photo didn't upload. Please try again."); }
}
