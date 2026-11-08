import { SlideCommit } from "@/components/ui/slide-commit";
import type { PlannedRoute } from "@/services/api/routing.service";
import { useRouter } from "expo-router";
import { useState } from "react";

export interface PlayButtonProps {
  activeRoute?: PlannedRoute | null;
  onStartRide?: () => void;
}

export function PlayButton({ activeRoute, onStartRide }: PlayButtonProps) {
  const router = useRouter();
  const [sliderKey, setSliderKey] = useState(0);

  const handleConfirm = async () => {
    // Memberikan jeda singkat 200ms untuk feedback getaran & sensor sync
    await new Promise((resolve) => setTimeout(resolve, 200));
  };

  const handleDone = () => {
    if (onStartRide) {
      onStartRide();
    } else if (activeRoute) {
      router.push({
        pathname: "/ride",
        params: {
          destinationName: activeRoute.destinationName,
          destinationLat: String(activeRoute.destinationPoint.latitude),
          destinationLon: String(activeRoute.destinationPoint.longitude),
          routeCoords: JSON.stringify(activeRoute.coordinates),
          distanceMeters: String(activeRoute.distanceMeters),
          durationSeconds: String(activeRoute.durationSeconds),
        },
      });
    } else {
      router.push("/ride");
    }

    // Reset key agar saat kembali dari ride slider siap digunakan kembali
    setTimeout(() => {
      setSliderKey((prev) => prev + 1);
    }, 600);
  };

  return (
    <SlideCommit
      key={sliderKey}
      label={
        activeRoute
          ? `Slide to Start: ${activeRoute.destinationName}`
          : "Slide to Start Ride"
      }
      doneLabel="Starting Ride..."
      errorLabel="Cannot start ride"
      onConfirm={handleConfirm}
      onDone={handleDone}
      trackColor="#1DA1F2"
      handleColor="#FFFFFF"
      successColor="#10B981"
      height={54}
      radius={27}
    />
  );
}
