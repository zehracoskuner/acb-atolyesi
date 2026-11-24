import { useEffect, useRef, useState } from "react";
import { apiGetCharacterPortrait, isPrivateCharacterPortrait } from "../../lib/api";
import { API_BASE } from "../../lib/apiBase";

function PortraitImage({ url, lazy, container, onUnavailable, onRatio }) {
  const privatePhoto = isPrivateCharacterPortrait(url);
  const [nearViewport, setNearViewport] = useState(!lazy);
  const [objectUrl, setObjectUrl] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!privatePhoto || nearViewport) return;
    const element = container.current;
    if (!element || !("IntersectionObserver" in window)) {
      setNearViewport(true);
      return;
    }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        observer.disconnect();
        setNearViewport(true);
      }
    }, { rootMargin: "120px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, [container, nearViewport, privatePhoto]);

  useEffect(() => {
    if (!privatePhoto || !nearViewport) return;
    const request = new AbortController();
    let localUrl;
    apiGetCharacterPortrait(url, { signal: request.signal })
      .then(blob => {
        if (request.signal.aborted) return;
        localUrl = URL.createObjectURL(blob);
        setObjectUrl(localUrl);
      })
      .catch(() => {
        if (request.signal.aborted) return;
        setFailed(true);
        onUnavailable?.(url);
      });
    return () => {
      request.abort();
      if (localUrl) URL.revokeObjectURL(localUrl);
    };
  }, [nearViewport, onUnavailable, privatePhoto, url]);

  const source = privatePhoto ? objectUrl : url.startsWith("/api/") ? API_BASE.replace(/\/api\/?$/, "") + url : url;
  if (failed || !source) return null;
  return <img src={source} alt="" loading={lazy && !privatePhoto ? "lazy" : "eager"} draggable={false}
    onLoad={event => {
      const { naturalWidth, naturalHeight } = event.currentTarget;
      if (naturalWidth && naturalHeight) onRatio?.(naturalWidth / naturalHeight);
    }} onError={() => {
    setFailed(true);
    onUnavailable?.(url);
  }} />;
}

export default function Portrait({ character, className = "", lazy = false, onUnavailable, onRatio }) {
  const container = useRef(null);
  const { name, imageUrl, color } = character;
  const initials = name?.trim().split(/\s+/).slice(0, 2).map(word => [...word][0]).join("").toLocaleUpperCase("tr") || "?";
  const tint = /^#[a-f\d]{6}$/i.test(color) ? color : undefined;
  return (
    <div ref={container} className={`cu-portrait ${className}`} style={{ "--cu-portrait-tint": tint }} aria-hidden="true">
      <span>{initials}</span>
      {imageUrl && <PortraitImage key={imageUrl} url={imageUrl} lazy={lazy} container={container}
        onUnavailable={onUnavailable} onRatio={onRatio} />}
    </div>
  );
}
