// utils/cloudinaryHelper.js
export function optimizeCloudinaryUrl(url, width = 400) {
  if (!url || !url.includes("cloudinary.com")) return url;
  
  // upload/ kelimesini bulup araya optimizasyon parametrelerini ekliyoruz
  const params = `upload/q_auto,f_auto,c_fill,w_${width}/`;
  return url.replace("upload/", params);
}