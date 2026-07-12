"use client";

import Image from "next/image";
import { ChangeEvent, DragEvent, useEffect, useRef, useState } from "react";
import {
  Camera,
  CameraOff,
  ImagePlus,
  LoaderCircle,
  Trash2,
  Upload,
} from "lucide-react";

import { Button } from "@/components/ui/button";

type ImageUploaderProps = {
  selectedImage: File | null;
  onImageSelect: (file: File | null) => void;
};

export function ImageUploader({
  selectedImage,
  onImageSelect,
}: ImageUploaderProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!selectedImage) {
      setPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(selectedImage);
    setPreviewUrl(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [selectedImage]);

  /*
   * Attach the camera stream only after React has rendered the video element.
   * This fixes the black camera preview.
   */
  useEffect(() => {
    if (!cameraOpen || !videoRef.current || !streamRef.current) {
      return;
    }

    const video = videoRef.current;

    video.srcObject = streamRef.current;

    async function startVideo() {
      try {
        await video.play();
      } catch {
        setError(
          "The camera opened, but the preview could not start. Check your browser camera permissions.",
        );
      }
    }

    video.addEventListener("loadedmetadata", startVideo);

    if (video.readyState >= 1) {
      void startVideo();
    }

    return () => {
      video.removeEventListener("loadedmetadata", startVideo);
    };
  }, [cameraOpen]);

  useEffect(() => {
    return () => {
      stopCameraStream();
    };
  }, []);

  function stopCameraStream() {
    streamRef.current?.getTracks().forEach((track) => {
      track.stop();
    });

    streamRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }

  function validateAndSelect(file?: File) {
    setError("");

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please select an image file.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("The image must be smaller than 10 MB.");
      return;
    }

    onImageSelect(file);
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    validateAndSelect(event.target.files?.[0]);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    validateAndSelect(event.dataTransfer.files?.[0]);
  }

  async function openCamera() {
    setError("");
    setCameraLoading(true);

    try {
      /*
       * Live camera requires HTTPS or localhost.
       * On an insecure phone connection, use the native camera input.
       */
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        cameraInputRef.current?.click();
        return;
      }

      stopCameraStream();

      /*
       * First try the rear camera where available.
       */
      let stream: MediaStream;

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: {
              ideal: "environment",
            },
          },
          audio: false,
        });
      } catch {
        /*
         * Some laptops do not support facingMode.
         * Retry with any available webcam.
         */
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      streamRef.current = stream;
      setCameraOpen(true);
    } catch (caughtError) {
      if (
        caughtError instanceof DOMException &&
        caughtError.name === "NotAllowedError"
      ) {
        setError(
          "Camera permission was denied. Allow camera access in your browser settings, then try again.",
        );
      } else if (
        caughtError instanceof DOMException &&
        caughtError.name === "NotFoundError"
      ) {
        setError("No camera was found on this device.");
      } else if (
        caughtError instanceof DOMException &&
        caughtError.name === "NotReadableError"
      ) {
        setError(
          "The camera is already being used by another application. Close FaceTime, Zoom, or other camera apps and try again.",
        );
      } else {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "The camera could not be opened.",
        );
      }
    } finally {
      setCameraLoading(false);
    }
  }

  function closeCamera() {
    stopCameraStream();
    setCameraOpen(false);
  }

  function capturePhoto() {
    const video = videoRef.current;

    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      setError("The camera is still loading. Wait a moment and try again.");
      return;
    }

    const canvas = document.createElement("canvas");

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext("2d");

    if (!context) {
      setError("The photo could not be captured.");
      return;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setError("The photo could not be captured.");
          return;
        }

        const file = new File([blob], `ingredients-${Date.now()}.jpg`, {
          type: "image/jpeg",
        });

        onImageSelect(file);
        closeCamera();
      },
      "image/jpeg",
      0.9,
    );
  }

  function removeImage() {
    closeCamera();
    onImageSelect(null);
    setError("");

    if (cameraInputRef.current) {
      cameraInputRef.current.value = "";
    }

    if (galleryInputRef.current) {
      galleryInputRef.current.value = "";
    }
  }

  return (
    <div>
      {/* Native phone camera fallback */}
      <input
        id="ingredient-camera-input"
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={handleInputChange}
      />

      {/* Gallery and desktop file picker */}
      <input
        id="ingredient-gallery-input"
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={handleInputChange}
      />

      {cameraOpen ? (
        <div className="overflow-hidden rounded-3xl border bg-white p-4 shadow-sm">
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-gray-950">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              disablePictureInPicture
              className="h-full w-full object-cover"
            />

            <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/10" />
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <Button type="button" className="flex-1" onClick={capturePhoto}>
              <Camera className="size-4" />
              Capture photo
            </Button>

            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={closeCamera}
            >
              <CameraOff className="size-4" />
              Close camera
            </Button>
          </div>
        </div>
      ) : !previewUrl ? (
        <div
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleDrop}
          className="flex min-h-[360px] flex-col items-center justify-center rounded-3xl border-2 border-dashed border-green-200 bg-green-50/40 px-6 py-12 text-center"
        >
          <span className="flex size-16 items-center justify-center rounded-2xl bg-green-100 text-green-700">
            <ImagePlus className="size-8" />
          </span>

          <h2 className="mt-6 text-xl font-bold">
            Upload your ingredient photo
          </h2>

          <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
            Take a new photo or choose a clear picture of your fridge, pantry,
            or ingredients.
          </p>

          <div className="mt-6 flex w-full max-w-md flex-col gap-3 sm:flex-row">
            <Button
              type="button"
              className="flex-1"
              disabled={cameraLoading}
              onClick={openCamera}
            >
              {cameraLoading ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Camera className="size-4" />
              )}

              {cameraLoading ? "Opening camera..." : "Take photo"}
            </Button>

            <label
              htmlFor="ingredient-gallery-input"
              className="inline-flex h-9 flex-1 cursor-pointer items-center justify-center gap-2 rounded-md border bg-white px-4 text-sm font-medium shadow-xs transition hover:bg-muted"
            >
              <Upload className="size-4" />
              Choose photo
            </label>
          </div>

          <p className="mt-4 text-xs text-muted-foreground">
            JPG, PNG or WebP, up to 10 MB
          </p>
        </div>
      ) : (
        <div className="rounded-3xl border bg-white p-4 shadow-sm">
          <div className="relative aspect-[16/10] overflow-hidden rounded-2xl bg-muted">
            <Image
              src={previewUrl}
              alt="Selected ingredients"
              fill
              unoptimized
              className="object-cover"
            />
          </div>

          <div className="mt-4 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="truncate font-semibold">{selectedImage?.name}</p>

              <p className="text-sm text-muted-foreground">
                Ready for ingredient detection
              </p>
            </div>

            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Remove selected image"
              onClick={removeImage}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
