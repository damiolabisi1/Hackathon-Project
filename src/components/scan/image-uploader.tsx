"use client";

import Image from "next/image";
import { ChangeEvent, DragEvent, useEffect, useRef, useState } from "react";
import {
  Camera,
  CameraOff,
  ImagePlus,
  RotateCcw,
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

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  function validateAndSelect(file?: File) {
    setError("");

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file.");
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
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error(
          "Camera access is unavailable. Open the app through HTTPS or localhost.",
        );
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: {
            ideal: "environment",
          },
        },
        audio: false,
      });

      streamRef.current = stream;
      setCameraOpen(true);

      requestAnimationFrame(async () => {
        if (!videoRef.current) return;

        videoRef.current.srcObject = stream;

        try {
          await videoRef.current.play();
        } catch {
          setError("The camera opened, but the video preview could not start.");
        }
      });
    } catch (cameraError) {
      if (
        cameraError instanceof DOMException &&
        cameraError.name === "NotAllowedError"
      ) {
        setError(
          "Camera permission was denied. Allow camera access in your browser settings and try again.",
        );
      } else if (
        cameraError instanceof DOMException &&
        cameraError.name === "NotFoundError"
      ) {
        setError("No camera was found on this device.");
      } else {
        setError(
          cameraError instanceof Error
            ? cameraError.message
            : "The camera could not be opened.",
        );
      }

      stopCamera();
    } finally {
      setCameraLoading(false);
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setCameraOpen(false);
  }

  function capturePhoto() {
    const video = videoRef.current;

    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      setError("The camera is not ready yet. Wait a moment and try again.");
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

        const photo = new File([blob], `ingredients-${Date.now()}.jpg`, {
          type: "image/jpeg",
        });

        onImageSelect(photo);
        stopCamera();
      },
      "image/jpeg",
      0.9,
    );
  }

  function removeImage() {
    onImageSelect(null);
    setError("");

    if (galleryInputRef.current) {
      galleryInputRef.current.value = "";
    }
  }

  return (
    <div>
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleInputChange}
      />

      {cameraOpen ? (
        <div className="overflow-hidden rounded-3xl border bg-black p-4 shadow-sm">
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-black">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="h-full w-full object-cover"
            />
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <Button type="button" className="flex-1" onClick={capturePhoto}>
              <Camera className="size-4" />
              Capture photo
            </Button>

            <Button
              type="button"
              variant="outline"
              className="flex-1 bg-white"
              onClick={stopCamera}
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
          className="flex min-h-[360px] flex-col items-center justify-center rounded-3xl border-2 border-dashed border-green-200 bg-green-50/40 px-8 py-12 text-center"
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

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button type="button" disabled={cameraLoading} onClick={openCamera}>
              {cameraLoading ? (
                <RotateCcw className="size-4 animate-spin" />
              ) : (
                <Camera className="size-4" />
              )}

              {cameraLoading ? "Opening camera..." : "Open camera"}
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => galleryInputRef.current?.click()}
            >
              <Upload className="size-4" />
              Choose photo
            </Button>
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
