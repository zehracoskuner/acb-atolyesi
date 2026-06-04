import { useState, useEffect, useCallback, useRef } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { TourManager } from "./tour/TourManager";
import { apiGet } from "../lib/api";

const Layout = () => {
  const { pathname } = useLocation();
  const [firstWorkPath, setFirstWorkPath] = useState(null);
  const [hasWorks,      setHasWorks]      = useState(undefined);
  const loadedRef = useRef(false); // works en az bir kez başarıyla yüklendi mi

  const loadWorks = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      // Token yok — yeni üye olabilir, undefined bırak (modal açılmasın)
      // Ama daha önce yükledik ve token gitti → false yap
      if (loadedRef.current) setHasWorks(false);
      return;
    }
    try {
      const data  = await apiGet("/works");
      const items = data.items || [];
      loadedRef.current = true;
      setHasWorks(items.length > 0);
      if (items.length > 0) {
        setFirstWorkPath(`/work/${items[0]._id || items[0].id}`);
      } else {
        setFirstWorkPath(null);
      }
    } catch {
      // API hatası — undefined bırak ki tur yanlış tetiklenmesin
      if (loadedRef.current) setHasWorks(false);
    }
  }, []);

  // ── İlk yükleme ─────────────────────────────────────────────────────────
  useEffect(() => {
    loadWorks();
  }, [loadWorks]);

  // ── Token değişince yeniden yükle (register → login → app akışı) ────────
  // localStorage'a "token" yazıldığında storage event ateşlenir (aynı sekme için
  // manuel dispatch gerekir — bkz. aşağıdaki not).
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === "token") {
        loadedRef.current = false; // sıfırla, yeni token = yeni kullanıcı
        setHasWorks(undefined);
        loadWorks();
      }
    };
    window.addEventListener("storage", onStorage);

    // Aynı sekme için: auth kodunda token set edildikten sonra
    //   window.dispatchEvent(new StorageEvent("storage", { key: "token" }))
    // çağrılmalı. Eğer çağrılmıyorsa aşağıdaki polling fallback devreye girer.
    return () => window.removeEventListener("storage", onStorage);
  }, [loadWorks]);

  // ── Polling fallback: token varken hasWorks hâlâ undefined ise yeniden dene
  // (storage event tetiklenmediği durumlara karşı güvenlik ağı)
  useEffect(() => {
    if (hasWorks !== undefined) return; // zaten yüklendi

    let attempts = 0;
    const id = setInterval(() => {
      const token = localStorage.getItem("token");
      if (token) {
        loadWorks();
        clearInterval(id);
      } else if (++attempts > 20) { // 10 saniye sonra pes et
        clearInterval(id);
        setHasWorks(false); // token gelmedi, modal açma
      }
    }, 500);

    return () => clearInterval(id);
  }, [hasWorks, loadWorks]);

  // ── Yeni eser oluşturulunca firstWorkPath'i güncelle ─────────────────────
  useEffect(() => {
    if (!firstWorkPath && /^\/work\/[^/]+$/.test(pathname)) {
      loadWorks();
    }
  }, [pathname, firstWorkPath, loadWorks]);

  return (
    <>
      <TourManager
        currentPath={pathname}
        firstWorkPath={firstWorkPath}
        hasWorks={hasWorks}
        onWorkCreated={(newPath) => {
          setFirstWorkPath(newPath);
          setHasWorks(true);
        }}
      />
      <Outlet />
    </>
  );
};

export default Layout;