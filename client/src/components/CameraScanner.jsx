import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";

/**
 * Renders a live camera feed and continuously scans it for a QR code using
 * jsQR (pure JS, decodes from raw pixel data — no native dependency, works
 * anywhere getUserMedia does). Calls onDecode(text) at most once per
 * `cooldownMs` window so holding a scanned ticket in frame doesn't fire
 * the same result dozens of times per second.
 */
export default function CameraScanner({ onDecode, cooldownMs = 2000 }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const lastScanRef = useRef(0);
  const rafRef = useRef(null);
  const [error, setError] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let stream;

    async function start() {
      // Browsers only expose getUserMedia in a "secure context" — https://,
      // or http://localhost. Opening this page via a LAN IP like
      // http://192.168.x.x:5173 on a phone is NOT secure, so
      // navigator.mediaDevices is simply undefined there — calling
      // .getUserMedia on it throws a generic TypeError that looks nothing
      // like a permissions problem. Checking for this up front means the
      // error message actually says what's wrong instead of a vague
      // "couldn't access the camera."
      if (!window.isSecureContext) {
        setError(
          "Camera access needs a secure (HTTPS) connection. If you're testing on your phone via a local network address (http://192.168...), see the README's HTTPS setup — plain http:// won't expose the camera on mobile browsers."
        );
        return;
      }
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError("This browser doesn't support camera access. Use manual entry below.");
        return;
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" }, // prefer the back camera on phones
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setReady(true);
          tick();
        }
      } catch (err) {
        if (err.name === "NotAllowedError") {
          setError("Camera access was denied. Allow camera permission in your browser settings, or use manual entry below.");
        } else if (err.name === "NotFoundError") {
          setError("No camera was found on this device. Use manual entry below.");
        } else if (err.name === "NotReadableError") {
          setError("The camera is already in use by another app. Close it and reload, or use manual entry below.");
        } else {
          setError(`Couldn't access the camera (${err.name || err.message}). Use manual entry below.`);
        }
      }
    }

    function tick() {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "dontInvert",
      });

      const now = Date.now();
      if (code && code.data && now - lastScanRef.current > cooldownMs) {
        lastScanRef.current = now;
        onDecode(code.data);
      }

      rafRef.current = requestAnimationFrame(tick);
    }

    start();

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (stream) stream.getTracks().forEach((track) => track.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return <p className="max-w-sm text-center text-sm text-stub-500">{error}</p>;
  }

  return (
    <div className="relative w-full max-w-sm overflow-hidden rounded-lg border border-paper/20">
      <video ref={videoRef} className="w-full" playsInline muted />
      <canvas ref={canvasRef} className="hidden" />
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-navy-950/80 text-sm text-paper/60">
          Starting camera…
        </div>
      )}
      {ready && (
        <div className="pointer-events-none absolute inset-6 rounded-lg border-2 border-amber-500/70" />
      )}
    </div>
  );
}
