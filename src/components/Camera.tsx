import React, { useRef, useEffect, useState } from 'react';
import { Camera as CapacitorCamera } from '@capacitor/camera';
import { Settings, Camera as CameraIcon, X } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { colorPalettes, applyDithering } from '@/utils/dither';
import { useToast } from "@/hooks/use-toast";

const Camera = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState({
    algorithm: 'ordered' as 'ordered' | 'floyd-steinberg' | 'atkinson',
    palette: 'obra-dinn',
    size: 3,
    brightness: 0,
    contrast: 0
  });
  const { toast } = useToast();

  useEffect(() => {
    startCamera();
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach(track => track.stop());
      }
    };
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          setIsVideoLoaded(true);
          videoRef.current?.play();
        };
      }
    } catch (err) {
      toast({
        title: "Camera Error",
        description: "Unable to access camera. Please check permissions.",
        variant: "destructive"
      });
    }
  };

  const processFrame = () => {
    if (!videoRef.current || !canvasRef.current || !isVideoLoaded) return;

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const process = () => {
      if (!videoRef.current || !canvasRef.current) return;
      
      // Match canvas size to video
      canvasRef.current.width = videoRef.current.videoWidth;
      canvasRef.current.height = videoRef.current.videoHeight;
      
      // Draw video frame to canvas
      ctx.drawImage(videoRef.current, 0, 0);
      
      // Get image data and apply dithering
      const imageData = ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
      const ditheredData = applyDithering(
        imageData,
        colorPalettes[settings.palette as keyof typeof colorPalettes],
        settings.algorithm,
        settings.size
      );
      
      // Draw dithered image back to canvas
      ctx.putImageData(ditheredData, 0, 0);
      
      requestAnimationFrame(process);
    };

    requestAnimationFrame(process);
  };

  useEffect(() => {
    if (isVideoLoaded) {
      processFrame();
    }
  }, [isVideoLoaded, settings]);

  const capturePhoto = async () => {
    if (!canvasRef.current || !videoRef.current) return;
    
    try {
      // Get screen dimensions
      const screenWidth = window.innerWidth;
      const screenHeight = window.innerHeight;
      const screenAspectRatio = screenWidth / screenHeight;

      // Get the video dimensions
      const videoWidth = videoRef.current.videoWidth;
      const videoHeight = videoRef.current.videoHeight;
      
      // Create a temporary canvas
      const tempCanvas = document.createElement('canvas');
      let cropWidth, cropHeight;
      
      // Calculate dimensions to match screen aspect ratio
      if (screenAspectRatio > 1) { // Landscape
        cropHeight = videoHeight;
        cropWidth = videoHeight * (16/9);
      } else { // Portrait
        cropWidth = videoWidth;
        cropHeight = videoWidth * (16/9);
      }
      
      // Center the crop
      const offsetX = (videoWidth - cropWidth) / 2;
      const offsetY = (videoHeight - cropHeight) / 2;
      
      // Set canvas size to match crop dimensions
      tempCanvas.width = cropWidth;
      tempCanvas.height = cropHeight;
      
      // Draw the cropped portion of the canvas
      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) return;
      
      tempCtx.drawImage(
        canvasRef.current,
        offsetX, offsetY, // Source position
        cropWidth, cropHeight, // Source dimensions
        0, 0, // Destination position
        cropWidth, cropHeight // Destination dimensions
      );
      
      const dataUrl = tempCanvas.toDataURL('image/png');
      
      // Create a temporary link element
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `dithered-photo-${Date.now()}.png`;
      
      // Append to body, click, and remove
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({
        title: "Success",
        description: "Photo captured! Check your downloads folder.",
      });
    } catch (err) {
      console.error('Error saving photo:', err);
      toast({
        title: "Error",
        description: "Failed to save photo.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="camera-container">
      <video 
        ref={videoRef}
        className="camera-feed"
        playsInline
        muted
      />
      <canvas 
        ref={canvasRef}
        className="absolute inset-0 w-full h-full object-cover"
      />
      
      <div className="controls">
        <Button
          variant="outline"
          size="icon"
          className="w-12 h-12 rounded-full bg-background/20 backdrop-blur-sm border-white/20"
          onClick={() => setShowSettings(true)}
        >
          <Settings className="w-6 h-6" />
        </Button>
        
        <Button
          variant="outline"
          size="icon"
          className="w-16 h-16 rounded-full bg-background/20 backdrop-blur-sm border-white/20"
          onClick={capturePhoto}
        >
          <CameraIcon className="w-8 h-8" />
        </Button>
      </div>

      {showSettings && (
        <div className="settings-modal bg-background/60 backdrop-blur-sm">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold">Settings</h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowSettings(false)}
            >
              <X className="w-6 h-6" />
            </Button>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">Algorithm</label>
              <Select
                value={settings.algorithm}
                onValueChange={(value) => setSettings(s => ({ ...s, algorithm: value as typeof s.algorithm }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ordered">Ordered</SelectItem>
                  <SelectItem value="floyd-steinberg">Floyd-Steinberg</SelectItem>
                  <SelectItem value="atkinson">Atkinson</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Color Palette</label>
              <Select
                value={settings.palette}
                onValueChange={(value) => setSettings(s => ({ ...s, palette: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.keys(colorPalettes).map(palette => (
                    <SelectItem key={palette} value={palette}>
                      {palette.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Dithering Size</label>
              <Slider
                value={[settings.size]}
                onValueChange={([value]) => setSettings(s => ({ ...s, size: value }))}
                min={1}
                max={10}
                step={1}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Brightness</label>
              <Slider
                value={[settings.brightness]}
                onValueChange={([value]) => setSettings(s => ({ ...s, brightness: value }))}
                min={-100}
                max={100}
                step={1}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Contrast</label>
              <Slider
                value={[settings.contrast]}
                onValueChange={([value]) => setSettings(s => ({ ...s, contrast: value }))}
                min={-100}
                max={100}
                step={1}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Camera;