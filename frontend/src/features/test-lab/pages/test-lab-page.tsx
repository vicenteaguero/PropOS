import { Camera, ImagePlus, Mic, Bell } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CameraCapture } from "@shared/components/camera-capture/camera-capture";
import { AudioRecorder } from "@shared/components/audio-recorder/audio-recorder";
import { PhotoPicker } from "@shared/components/photo-picker/photo-picker";
import { useNotifications } from "@shared/hooks/use-notifications";
import { useMediaFiles } from "@shared/hooks/use-media-files";

export function TestLabPage() {
  const { photos, galleryPhotos, audios, saveMediaFile } = useMediaFiles();
  const { permission, requestPermission, sendTestNotification } = useNotifications();

  const permissionColor = permission === "granted"
    ? "default"
    : permission === "denied"
      ? "destructive"
      : "secondary";

  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="text-lg font-semibold">PWA Test Lab</h1>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Camera Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Camera className="size-4" />
              Cámara
            </CardTitle>
            <CardDescription>Captura fotos con la cámara del dispositivo</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <CameraCapture onSaved={(url) => saveMediaFile(url, "photo", "camera")} />

            {photos.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Fotos capturadas ({photos.length})
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {photos.map((m) => (
                    <img key={m.id} src={m.url} alt="Captured" className="rounded-md" />
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Photo Picker Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <ImagePlus className="size-4" />
              Galería
            </CardTitle>
            <CardDescription>Selecciona fotos del dispositivo</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <PhotoPicker onSaved={(url) => saveMediaFile(url, "photo", "gallery")} />

            {galleryPhotos.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Fotos seleccionadas ({galleryPhotos.length})
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {galleryPhotos.map((m) => (
                    <img key={m.id} src={m.url} alt="Selected" className="rounded-md" />
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Audio Recorder Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Mic className="size-4" />
              Audio
            </CardTitle>
            <CardDescription>Graba audio con el micrófono</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <AudioRecorder onSaved={(url) => saveMediaFile(url, "audio", "recorder")} />

            {audios.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Grabaciones ({audios.length})
                </p>
                {audios.map((m) => (
                  <audio key={m.id} src={m.url} controls className="w-full" />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notifications Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Bell className="size-4" />
              Notificaciones
            </CardTitle>
            <CardDescription>Prueba las notificaciones del dispositivo</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Estado:</span>
              <Badge variant={permissionColor}>
                {permission === "granted" ? "Permitido" : permission === "denied" ? "Denegado" : permission === "unsupported" ? "No soportado" : "Sin solicitar"}
              </Badge>
            </div>

            <div className="flex gap-2">
              {permission !== "granted" && permission !== "unsupported" && (
                <Button variant="outline" onClick={requestPermission}>
                  Solicitar Permiso
                </Button>
              )}
              <Button
                onClick={sendTestNotification}
                disabled={permission !== "granted"}
              >
                Enviar Test
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
